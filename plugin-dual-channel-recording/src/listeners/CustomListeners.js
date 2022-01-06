import { Actions, Manager, TaskHelper } from '@twilio/flex-ui';
import { ParticipantType, ReservationEvents } from '../enums';

const manager = Manager.getInstance();
const reservationListeners = new Map();
const { REACT_APP_RECORD_CHANNEL } = process.env;

const startCallRecording = async (callSid) => {
  console.debug('Creating recording for call SID:', callSid);
  const fetchUrl = `https://${process.env.REACT_APP_SERVERLESS_DOMAIN}/create-recording`;

  const fetchBody = {
    Token: manager.store.getState().flex.session.ssoTokenPayload.token,
    callSid,
  };
  const fetchOptions = {
    method: 'POST',
    body: new URLSearchParams(fetchBody),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
  };

  let recording;
  try {
    const recordingResponse = await fetch(fetchUrl, fetchOptions);
    recording = await recordingResponse.json();
    console.debug('Created recording', recording);
  } catch (error) {
    console.error(`Error creating recording for call SID ${callSid}.`, error);
  }

  return recording;
};

const addCallDataToTask = async (task, callSid, recording) => {
  const { attributes, conference } = task;

  const newAttributes = { ...attributes };
  let shouldUpdateTaskAttributes = false;

  if (TaskHelper.isOutboundCallTask(task)) {
    shouldUpdateTaskAttributes = true;
    // Last Reviewed: 2021/02/01 (YYYY/MM/DD)
    // Outbound calls initiated from Flex (via StartOutboundCall Action)
    // do not include call_sid and conference metadata in task attributes
    newAttributes.conference = { sid: conference.conferenceSid };

    // callSid will be undefined if the outbound call was ended before
    // the called party answered
    newAttributes.call_sid = callSid;
  }

  if (recording) {
    shouldUpdateTaskAttributes = true;
    const conversations = attributes.conversations || {};

    const state = manager.store.getState();
    const flexState = state && state.flex;
    const workerState = flexState && flexState.worker;
    const accountSid = workerState && workerState.source.accountSid;

    const { sid: recordingSid } = recording;
    const twilioApiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
    const recordingUrl = `${twilioApiBase}/Recordings/${recordingSid}`;

    const { dateUpdated } = task;

    // Using one second before task updated time to workaround a Flex Insights
    // bug if the recording start time is after the reservation.accepted event
    const recordingStartTime = new Date(dateUpdated).valueOf() - 1000;

    // NOTE: This schema is applicable if recording the customer leg since there
    // is a single recording for the entire call. If instead you're recording the
    // worker leg, which could result in multiple recordings per call in the case
    // of a transfer, then you'll want to use the reservation_attributes pattern:
    // https://www.twilio.com/docs/flex/developer/insights/custom-media-attached-conversations#add-media-links
    const mediaObj = {
      url: recordingUrl,
      type: 'VoiceRecording',
      start_time: recordingStartTime,
      channels: ['customer', 'others'],
    };
    console.debug('NEWATTRIBUTES: ', newAttributes);
    if (Object.keys(conversations).length === 0) {
      newAttributes.conversations = {
        ...conversations,
        media: [mediaObj],
      };
    } else {
      newAttributes.conversations.media.push(mediaObj);
      newAttributes.conversations = {
        ...conversations,
      };
    }
  }

  if (shouldUpdateTaskAttributes) {
    await task.setAttributes(newAttributes);
  }
};

const isTaskActive = (task) => {
  const { sid: reservationSid, taskStatus } = task;
  if (taskStatus === 'canceled') {
    return false;
  } else {
    return manager.workerClient.reservations.has(reservationSid);
  }
};

const waitForConferenceParticipants = (task) =>
  new Promise((resolve) => {
    const waitTimeMs = 100;
    // For outbound calls, the customer participant doesn't join the conference
    // until the called party answers. Need to allow enough time for that to happen.
    const maxWaitTimeMs = 60000;
    let waitForConferenceInterval = setInterval(async () => {
      const { conference } = task;

      if (!isTaskActive(task)) {
        console.debug('Call canceled, clearing waitForConferenceInterval');
        waitForConferenceInterval = clearInterval(waitForConferenceInterval);
        return;
      }
      if (conference === undefined) {
        return;
      }
      const { participants } = conference;
      if (Array.isArray(participants) && participants.length < 2) {
        return;
      }
      const worker = participants.find(
        (p) => p.participantType === ParticipantType.worker
      );
      const customer = participants.find(
        (p) => p.participantType === ParticipantType.customer
      );

      if (!worker || !customer) {
        return;
      }

      console.debug('Worker and customer participants joined conference');
      waitForConferenceInterval = clearInterval(waitForConferenceInterval);

      resolve(participants);
    }, waitTimeMs);

    setTimeout(() => {
      if (waitForConferenceInterval) {
        console.debug(
          `Customer participant didn't show up within ${
            maxWaitTimeMs / 1000
          } seconds`
        );
        clearInterval(waitForConferenceInterval);

        resolve([]);
      }
    }, maxWaitTimeMs);
  });

const addMissingCallDataIfNeeded = async (task) => {
  const { attributes } = task;
  const { conference } = attributes;

  if (TaskHelper.isOutboundCallTask(task) && !conference) {
    // Only worried about outbound calls since inbound calls automatically
    // have the desired call and conference metadata
    await addCallDataToTask(task);
  }
};

Actions.addListener('beforeCompleteTask', async (payload) => {
  // Listening for this event as a last resort check to ensure call
  // and conference metadata are captured on the task
  addMissingCallDataIfNeeded(payload.task);
});

Actions.addListener('beforeHangupCall', async (payload) => {
  // Listening for this event to at least capture the conference SID
  // if the outbound call is canceled before the called party answers
  addMissingCallDataIfNeeded(payload.task);
});

const handleAcceptedCall = async (task) => {
  const { attributes } = task;
  const { conversations } = attributes;

  if (
    conversations &&
    conversations.media &&
    REACT_APP_RECORD_CHANNEL == 'customer'
  ) {
    // This indicates a recording has already been started for this call
    // and all relevant metadata should already be on task attributes
    return;
  }

  // We want to wait for all participants (customer and worker) to join the
  // conference before we start the recording
  console.debug('Waiting for customer and worker to join the conference');
  const participants = await waitForConferenceParticipants(task);
  const participantLeg = participants.find(
    (p) => p.participantType === REACT_APP_RECORD_CHANNEL
  );

  console.debug('Recorded Participant: ', participantLeg);

  if (!participantLeg) {
    console.warn(
      'No customer or worker participant. Not starting the call recording'
    );
    return;
  }

  // Choosing to record the customer call SID here. If you want to record
  // the worker leg of the call instead, adjust the logic above to find
  // the worker participant and use that call SID instead.
  const { callSid } = participantLeg;

  const recording = await startCallRecording(callSid);
  await addCallDataToTask(task, callSid, recording);
};

const handleReservationAccepted = async (reservation) => {
  const task = TaskHelper.getTaskByTaskSid(reservation.sid);

  if (TaskHelper.isCallTask(task)) {
    await handleAcceptedCall(task);
  }
};

const handleReservationUpdated = (event, reservation) => {
  console.debug('Event, reservation updated', event, reservation);
  switch (event) {
    case ReservationEvents.accepted: {
      handleReservationAccepted(reservation);
      break;
    }
    case ReservationEvents.wrapup:
    case ReservationEvents.completed:
    case ReservationEvents.rejected:
    case ReservationEvents.timeout:
    case ReservationEvents.canceled:
    case ReservationEvents.rescinded: {
      stopReservationListeners(reservation);
      break;
    }
    default:
      break;
  }
};

const stopReservationListeners = (reservation) => {
  const listeners = reservationListeners.get(reservation);
  if (listeners) {
    listeners.forEach((listener) => {
      reservation.removeListener(listener.event, listener.callback);
    });
    reservationListeners.delete(reservation);
  }
};

const initReservationListeners = (reservation) => {
  const trueReservation = reservation.addListener
    ? reservation
    : reservation.source;
  stopReservationListeners(trueReservation);
  const listeners = [];
  Object.values(ReservationEvents).forEach((event) => {
    const callback = () => handleReservationUpdated(event, trueReservation);
    trueReservation.addListener(event, callback);
    listeners.push({ event, callback });
  });
  reservationListeners.set(trueReservation, listeners);
};

const handleNewReservation = (reservation) => {
  console.debug('new reservation', reservation);
  initReservationListeners(reservation);
};

const handleReservationCreated = (reservation) => {
  handleNewReservation(reservation);
};

manager.workerClient.on('reservationCreated', (reservation) => {
  handleReservationCreated(reservation);
});
