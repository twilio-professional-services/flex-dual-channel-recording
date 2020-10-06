import { Actions, Manager, TaskHelper } from '@twilio/flex-ui';

const manager = Manager.getInstance();

const startCallRecording = async (callSid) => {
  console.debug('Creating recording for call SID:', callSid);
  const fetchUrl = `https://${process.env.REACT_APP_SERVERLESS_DOMAIN}/create-recording`;

  const fetchBody = {
    Token: manager.store.getState().flex.session.ssoTokenPayload.token,
    callSid
  };
  const fetchOptions = {
    method: 'POST',
    body: new URLSearchParams(fetchBody),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    }
  };
  const recordingResponse = await fetch(fetchUrl, fetchOptions);
  const recording = await recordingResponse.json();
  console.debug('Created recording', recording);
  return recording;
}

const addCallDataToTask = async (task, callSid, recording) => {
  const { attributes, conference } = task;

  const newAttributes = {
    ...attributes,
    call_sid: callSid,
    conference: conference && {
      sid: conference && conference.conferenceSid
    },
  };

  if (recording) {
    const conversations = attributes.conversations || {};
    const media = conversations.media || [];

    const state = manager.store.getState();
    const flexState = state && state.flex;
    const workerState = flexState && flexState.worker;
    const accountSid = workerState && workerState.source.accountSid;

    const { sid: recordingSid, startTime: recordingStartTime } = recording;
    const twilioApiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
    const recordingUrl = `${twilioApiBase}/Recordings/${recordingSid}`;

    newAttributes.conversations = {
      ...conversations,
      media: [
        ...media,
        {
          url: recordingUrl,
          type: 'VoiceRecording',
          start_time: recordingStartTime,
          channels: [ 'customer', 'others' ]
        }
      ]
    };
  }
  await task.setAttributes(newAttributes);
}

const isTaskActive = (task) => {
  const { sid, taskStatus } = task;
  if (taskStatus === 'canceled') {
    return false;
  } else {
    return manager.workerClient.reservations.has(sid);
  }
}

const waitForConferenceParticipants = (task) => new Promise(resolve => {
  const waitTimeMs = 100;
  // For outbound calls, the customer participant doesn't join the conference 
  // until the called party answers. Need to allow enough time for that to happen.
  const maxWaitTimeMs = 60000;
  let waitForConferenceInterval = setInterval(async () => {
    const { conference, taskStatus } = task;
    const conferenceSid = conference && conference.conferenceSid;
    console.debug(`waitForConferenceInterval, conference: ${conferenceSid}, taskStatus: ${taskStatus}`);

    if (!isTaskActive(task)) {
      console.debug('Call canceled, clearing waitForConferenceInterval');
      clearInterval(waitForConferenceInterval)
      waitForConferenceInterval = undefined;
      return;
    }
    if (conference === undefined) {
      return;
    }
    const { participants } = conference;
    if (Array.isArray(participants) && participants.length < 2) {
      return;
    }
    const worker = participants.find(p => p.participantType === 'worker');
    const customer = participants.find(p => p.participantType === 'customer');

    if (!worker || !customer) {
      return;
    }

    console.debug('Worker and customer participants joined conference');
    clearInterval(waitForConferenceInterval);
    waitForConferenceInterval = undefined;

    resolve(participants);
  }, waitTimeMs);

  setTimeout(() => {
    if (waitForConferenceInterval) {
      console.debug(`Customer participant didn't show up within ${maxWaitTimeMs / 1000} seconds`);
      clearInterval(waitForConferenceInterval)

      resolve([])
    }
  }, maxWaitTimeMs);
});

const handleAcceptedCall = async (task) => {
  const participants = await waitForConferenceParticipants(task);

  const customer = participants.find(p => p.participantType === 'customer');

  if (!customer) {
    console.warn('No customer participant. Not starting the call recording');
    return;
  }

  const { callSid } = customer;

  const recording = await startCallRecording(callSid);
  await addCallDataToTask(task, callSid, recording);
};

Actions.addListener('afterAcceptTask', async payload => {
  const { task } = payload;
  
  // Adjust this logic as necessary to suit business requirements for recording calls
  const shouldRecordCall = TaskHelper.isOutboundCallTask(task);

  if (shouldRecordCall) {
    await handleAcceptedCall(task);
  }
});

Actions.addListener('beforeHangupCall', async payload => {
  const { task } = payload;
  const { attributes } = task;
  const { conference } = attributes;

  if (TaskHelper.isOutboundCallTask(task) && !conference) {
    await addCallDataToTask(task);
  }
});
