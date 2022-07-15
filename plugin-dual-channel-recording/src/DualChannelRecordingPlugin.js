import { FlexPlugin } from '@twilio/flex-plugin';

import './listeners/CustomListeners';

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
    // All logic managed in CustomListeners.js

    // Test to make sure the REACT_APP_RECORD_CHANNEL .env variable has been
    // configured correctly. If it has not, throw errors and notifications.
    if (
      process.env.REACT_APP_RECORD_CHANNEL.toLowerCase() != 'worker' &&
      process.env.REACT_APP_RECORD_CHANNEL.toLowerCase() != 'customer'
    ) {
      flex.Notifications.registerNotification({
        id: 'brokenVar',
        content:
          'The Dual Channel Recording plugin will not work because the .env file has not been configured correctly.', // string
        type: 'error',
        timeout: 0,
      });

      flex.Notifications.showNotification('brokenVar', null);
      console.error(
        'ERROR: REACT_APP_RECORD_CHANNEL env variable does not have the correct value. Refer to your .env file to fix.'
      );
    }
  }
}
