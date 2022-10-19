# Flex Dual Channel Recording Solution
This plugin is no longer maintained as of October 17th, 2022. Work to maintain this feature in Flex V2 has been moved over to the [Twilio Professional Services Flex Project Template](https://github.com/twilio-professional-services/twilio-proserv-flex-project-template) where it is an [optional feature](https://github.com/twilio-professional-services/flex-project-template/tree/main/plugin-flex-ts-template-v2/src/feature-library/dual-channel-recording/README.md)

## Overview

There are various ways to enable call recordings with Twilio Flex. Let's outline those methods to better understand when using this custom solution would be preferable.

1. The simplest approach is to turn on "Call Recording" in [Flex Settings](https://www.twilio.com/console/flex/settings) on the Twilio Console. Enabling this setting records the conference and automatically updates the task attribute `conversations.segment_link` with the recording URL so it can be played back in Flex Insights.
   - Pros:
     - One click configuration, no custom code or setup required
     - All inbound and outbound calls are automatically recorded
   - Cons:
     - Conference recordings are single channel, or mono, recordings. This means analytics tools like Flex Insights are unable to determine if the customer or the agent is speaking, limiting capabilities of those tools such as detecting cross talk.
     - No option for custom business logic to determine which calls are recorded. All calls, inbound and outbound, are recorded.
1. Follow our [Enabling Dual-Channel Recordings](https://www.twilio.com/docs/flex/developer/insights/enable-dual-channel-recordings#using-studio-to-enable-recordings) guide to start a dual-channel recording in Studio and capture recording metadata on the task attributes for playback in Flex Insights
   - Pros:
     - No custom code required. Configuration is done entirely in Studio's graphical interface.
     - Recordings are dual-channel, capturing customer and agent audio in their own audio channels
     - Custom business logic can be leveraged in Studio to selectively record calls
     - All audio played to the customer by the IVR can be included in the recording, depending where in the Studio flow the recording is started. This is helpful for situations when you need to capture a specific message played to the customer, such as a notification that the call is being recorded.
   - Cons:
     - All audio played to the caller while they wait in queue for an agent to become available will be included in the recording. This is likely not an issue for contact centers with low wait times, but when wait times are long, recording durations will increase along with recording storage costs.
     - This method does not address outbound calls from Flex as Studio flows are only triggered by inbound calls. So a custom solution would be required to record outbound calls.
1. The solution in this Github repository is the third method we'll consider. Recordings are started from a Flex plugin, leveraging a server side Twilio Function to call the Twilio Recordings API. The task attribute `conversations.media` is updated with the recording metadata so Flex Insights can play the recording.
   - Pros:
     - Recordings are dual-channel, capturing customer and agent audio in their own audio channels
     - The same solution works for both inbound and outbound calls
     - Custom business logic can be leveraged to selectively record calls
     - The recording begins from the moment the customer and agent are connected, so no IVR or queue hold audio is captured in the recording
   - Cons:
     - Custom code is required, both on the front end (Flex plugin) and the backend (Twilio Function)
     - If it's desired to record the IVR messaging, that will not be included

## Deployment Steps

### Twilio Function

The Twilio Functions should be deployed first so the serverless environment domain can be captured for use in the Flex Plugin. Navigate to the `dual-channel-rec-serverless` folder in this repository for instructions on deploying the Twilio Function.

> **NOTE:** Once the Twilio Function is deployed, make note of the Domain returned by the CLI command `twilio serverless:deploy`

### Flex Plugin

Navigate to the `plugin-dual-channel-recording` folder in this repository for instructions on deploying the Flex Plugin.

> **NOTE:** Before deploying, make a copy of `.env.sample`, rename it to `.env` and populate the `REACT_APP_SERVERLESS_DOMAIN=` variable with the Twilio Serverless Domain noted from the Twilio Function deployment. Also populate the `REACT_APP_RECORD_CHANNEL=` variable with either the word 'customer' or 'worker'.

---

# General Flex Plugin Setup

The following instructions illustrate a quick way to get this Flex plugin code up and running locally, so you can customize and test this code before deploying it to Twilio. These instructions also show how to do a simple deploy to Twilio using the Twilio CLI. More in-depth instructions for building, running, and deploying Flex Plugins can be found in the [Flex Plugins documentation](https://www.twilio.com/docs/flex/developer/plugins). An example of the topics covered are:

- [Running multiple Flex Plugins locally](https://www.twilio.com/docs/flex/developer/plugins/cli/run-multiple-plugins)
- [Using the CLI to programmatically deploy Flex Plugins to Twilio](https://www.twilio.com/docs/flex/developer/plugins/cli/deploy-and-release)
- [Use the Flex Plugins Dashboard](https://www.twilio.com/docs/flex/developer/plugins/dashboard)

## Requirements

- An active Twilio Flex account
- A command line tool like Terminal or iTerm
- [Node.js and npm](https://nodejs.org/en/) (npm is installed with Node)

  - A slightly more elegent solution to installing Node.js is by using [Node Version Manager or nvm](https://github.com/nvm-sh/nvm). This is optional, but many developers prefer the ability to control versions of Node.js from project to project.

- [The Twilio CLI](https://www.twilio.com/docs/twilio-cli/quickstart)

- The [Flex Plugin extension](https://www.twilio.com/docs/twilio-cli/plugins#available-plugins) to the Twilio CLI

> **Impotant Note:** If this Flex Plugin requires the use of [Twilio Serverless Functions](https://www.twilio.com/docs/runtime/functions), then be sure to have your [Node.js version set to 14](https://www.twilio.com/docs/runtime/runtime-node-upgrade) within the Serverless Functions directy in your code. This is where using nvm would come in handy as you can set the Node.js version to 14 in an [.nvmrc file](https://github.com/nvm-sh/nvm#nvmrc) in the Serverless Functions directory and set the Node.js version running React/Twilio Flex to a different version.

### A Note About Twilio CLI for Flex

The Twilio CLI is required in the following steps to run and install this plugin. Be sure you are working within the correct profile in your CLI before you deploy code. Each CLI profile is associated with a specific Twilio accounts, so you don't want to mistakenly push code to the wrong Twilio account. Review the [CLI General Usage](https://www.twilio.com/docs/twilio-cli/general-usage) documentation for further details about CLI profiles.

#### CLI General Use

**Create a CLI Profile**
From command line run: `twilio login`
Follow the prompts to finish creating a profile.

**List CLI Profiles**
From command line run: `twilio profiles:list`

**Usa a CLI Profile**
From commandline run: `twilio profiles:use PROFILE_NAME`

## Step 1: Download Plugin Code

> :information_source: If you've used the Twilio CLI to create a Flex Plugin from scratch, you can skip Step 1.

Doanload or clone this code repository to your local development environment.

GitHub provides several options for downloading this source code:

- Use the [GitHub desktop](https://desktop.github.com/) application
- Clone the code via [HTTPS, SSH, or GitHub CLI](https://docs.github.com/en/get-started/getting-started-with-git/about-remote-repositories)
- Download a zip file of this code.

## Step 2: Install Dependencies

1. Once the plugin code has been downloaded to your development environment, open a Command Line interface and `cd` into the root code directory.
2. Once in the root plugin code directory run the following in Command Line: `npm install` or `npm i`
3. All of the code dependencies are installed and you may now start building and running your code locally.

## Step 3: Run Plugin Locally

1. This plugin can be run locally in your default browser by running the following in Command Line: `twilio flex:plugins:start`
2. You will be prompted to login. At this point you can select to use your Twilio login to log into Flex.
3. Once logged into Flex you will see that Flex will be running on `localhost:3000` in your browser.

## Step 4: Deploy and Release Plugin to Twilio

The `twilio flex:plugins:deploy` command automates the process of uploading your plugin to Flex. This allows you to deploy your plugins via the command line, without needing to manually upload them using a GUI. After a deploy, your plugin is not yet enabled for all your users on your Flex application. You need to run the `release` command after the deploy to enable any changes.

The `twilio flex:plugins:release` command is used to change which plugins are live for your users. You can group multiple plugins into a release, and you can re-activate any prior release to rollback changes.

See the [Deploy and Release documentation](https://www.twilio.com/docs/flex/developer/plugins/cli/deploy-and-release) for full detailed instructions.
