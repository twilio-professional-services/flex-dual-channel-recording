import React from 'react';
import { VERSION } from '@twilio/flex-ui';
import { FlexPlugin } from 'flex-plugin';

const PLUGIN_NAME = 'DualChannelRecordingPlugin';

export default class DualChannelRecordingPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  /**
   * This code is run when your plugin is being started
   * Use this to modify any UI components or attach to the actions framework
   *
   * @param flex { typeof import('@twilio/flex-ui') }
   * @param manager { import('@twilio/flex-ui').Manager }
   */
  init(flex, manager) {
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
      console.debug('Created recording', recording && recording.sid);
    }

    const isTaskActive = (task) => {
      const { sid, taskStatus } = task;
      if (taskStatus === 'canceled') {
        return false;
      } else {
        return manager.workerClient.reservations.has(sid);
      }
    }

    const waitForCustomerParticipant = (task) => {
      const waitTimeMs = 100;
      // For outbound calls, the customer participant doesn't join the conference 
      // until the called party answers. Need to allow enough time for that to happen.
      const maxWaitTimeMs = 60000;
      let waitForConferenceInterval = setInterval(async () => {
        const { conference, taskStatus } = task;
        console.debug('waitForConferenceInterval, taskStatus: ', taskStatus);

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
        const customer = (
          Array.isArray(participants)
          && participants.find(p => p.participantType === 'customer')
        );
        if (!customer) {
          return;
        }
        console.debug('Customer participant joined conference');
        clearInterval(waitForConferenceInterval);
        waitForConferenceInterval = undefined;
        const { callSid: customerCallSid } = customer;
        await startCallRecording(customerCallSid);
      }, waitTimeMs);

      setTimeout(() => {
        if (waitForConferenceInterval) {
          console.debug(`Customer participant didn't show up within ${maxWaitTimeMs / 1000} seconds`);
          clearInterval(waitForConferenceInterval)
        }
      }, maxWaitTimeMs);
    }

    const handleAcceptedCall = async (task) => {
      const { attributes } = task;
      const { call_sid: callSid } = attributes;

      if (callSid) {
        // Presence of call_sid on task attributes means the customer's call SID is known
        // and the recording can be started immediately on that call resource
        await startCallRecording(callSid);
      } else {
        // Lack of call_sid on task attributes means we need to wait for the customer
        // participant to join the conference before we can start recording that call
        waitForCustomerParticipant(task);
      }
    }

    flex.Actions.addListener('afterAcceptTask', async payload => {
      const { task } = payload;

      if (flex.TaskHelper.isCallTask(task)) {
        await handleAcceptedCall(task);
      }
    })
  }
}
