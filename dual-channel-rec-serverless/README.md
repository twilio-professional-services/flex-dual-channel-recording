# Serverless Functions

## Prerequisites

If you don't already have the Twilio CLI tools installed, follow this Quickstart guide to install them on your machine.

https://www.twilio.com/docs/twilio-cli/quickstart

Once that's done, follow the instructions here to install the Serverless Toolkit plugin for Twilio CLI.

https://www.twilio.com/docs/labs/serverless-toolkit/getting-started#install-the-twilio-serverless-toolkit

## Instructions

1. From a terminal, navigate to the `dual-channel-rec-serverless` folder in this repository
1. Run `npm i` to install all node.js package dependencies
1. From your terminal again, run `twilio serverless:deploy` to deploy the functions to your Twilio Flex project
    1. Feel free to leverage deploy command options such as `--environment` if you'd like to modify the deployment properties
1. Once the deployment is completed, note the `Domain` in the Deployment Details shown in the terminal. This will be used in the Flex Plugin `.env` environment variable file.