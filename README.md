# Flex Dual Channel Recording Solution

## Overview
There are various ways to enable call recordings with Twilio Flex. Let's outline those methods to better understand when using this custom solution would be preferable.

1. The simplest approach is to turn on "Call Recording" in [Flex Settings](https://www.twilio.com/console/flex/settings) on the Twilio Console. Enabling this setting records the conference and automatically updates the task attribute `conversations.segment_link` with the recording URL so it can be played back in Flex Insights.
    * Pros:
      * One click configuration, no custom code or setup required
      * All inbound and outbound calls are automatically recorded
    * Cons:
      * Conference recordings are single channel, or mono, recordings. This means analytics tools like Flex Insights are unable to determine if the customer or the agent is speaking, limiting capabilities of those tools such as detecting cross talk.
      * No option for custom business logic to determine which calls are recorded. All calls, inbound and outbound, are recorded.
1. Follow our [Enabling Dual-Channel Recordings](https://www.twilio.com/docs/flex/developer/insights/enable-dual-channel-recordings#using-studio-to-enable-recordings) guide to start a dual-channel recording in Studio and capture recording metadata on the task attributes for playback in Flex Insights
    * Pros:
      * No custom code required. Configuration is done entirely in Studio's graphical interface.
      * Recordings are dual-channel, capturing customer and agent audio in their own audio channels
      * Custom business logic can be leveraged in Studio to selectively record calls
      * All audio played to the customer by the IVR can be included in the recording, depending where in the Studio flow the recording is started. This is helpful for situations when you need to capture a specific message played to the customer, such as a notification that the call is being recorded.
    * Cons:
      * All audio played to the caller while they wait in queue for an agent to become available will be included in the recording. This is likely not an issue for contact centers with low wait times, but when wait times are long, recording durations will increase along with recording storage costs.
      * This method does not address outbound calls from Flex as Studio flows are only triggered by inbound calls. So a custom solution would be required to record outbound calls.
1. The solution in this Github repository is the third method we'll consider. Recordings are started from a Flex plugin, leveraging a server side Twilio Function to call the Twilio Recordings API. The task attribute `conversations.media` is updated with the recording metadata so Flex Insights can play the recording.
    * Pros:
      * Recordings are dual-channel, capturing customer and agent audio in their own audio channels
      * The same solution works for both inbound and outbound calls
      * Custom business logic can be leveraged to selectively record calls
      * The recording begins from the moment the customer and agent are connected, so no IVR or queue hold audio is captured in the recording
    * Cons:
      * Custom code is required, both on the front end (Flex plugin) and the backend (Twilio Function)
      * If it's desired to record the IVR messaging, that will not be included

## Deployment Steps

### Twilio Function
The Twilio Functions should be deployed first so the serverless environment domain can be captured for use in the Flex Plugin. Navigate to the `dual-channel-rec-serverless` folder in this repository for instructions on deploying the Twilio Function.

Once the Twilio Function is deployed, make note of the Domain returned by the CLI command `twilio serverless:deploy`.

### Flex Plugin
Navigate to the `plugin-dual-channel-recording` folder in this repository for instructions on deploying the Flex Plugin. Before deploying, be sure to rename `.env.sample` to `.env` and populate the `REACT_APP_SERVERLESS_DOMAIN=` variable with the Twilio Serverless Domain noted from the Twilio Function deployment.