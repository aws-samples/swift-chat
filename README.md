[中文](/README_CN.md)

# SwiftChat - A Cross-platform AI Chat App

SwiftChat is a fast and responsive AI chat application developed with [React Native](https://reactnative.dev/) and
powered by [Amazon Bedrock](https://aws.amazon.com/bedrock/). With its minimalist design philosophy and robust privacy
protection, it delivers real-time streaming conversations and AI image generation capabilities across Android, iOS, and
macOS platforms.

![](assets/promo.png)

**Key Features:**

- Real-time streaming chat with AI
- AI image generation with progress
- Multimodal support (camera, photos & documents)
- Conversation history list view and management
- Cross-platform support (Android, iOS, macOS)
- Tablet-optimized for iPad and Android tablets
- Fast launch and responsive performance
- Multiple AI model support and switching

## Architecture

![](/assets/architecture.png)

By default, we use AWS App Runner, which is commonly used to host Python FastAPI servers, offering high performance,
scalability and low latency.

Alternatively, we provide the option to replace App Runner with AWS Lambda using Function URL for a more cost-effective
solution, as shown in
this [example](https://github.com/awslabs/aws-lambda-web-adapter/tree/main/examples/fastapi-response-streaming).

## Getting Started

### Prerequisites

Ensure you have access to Amazon Bedrock foundation models. SwiftChat default settings are:

* Region: `us-west-2`
* Text Model: `Claude 3.5 Sonnet`
* Image Model: `Stable Image Core 1.0`

Follow the [Amazon Bedrock User Guide](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access-modify.html) to
enable your models.

### Step 1: Set up your API Key

1. Right-click [Parameter Store](https://console.aws.amazon.com/systems-manager/parameters/) to open your AWS Console in
   new window.
2. Check whether you are in the [supported region](#supported-region), then click on the **Create parameter** button.
3. Fill the parameters below, leaving other options as default.
    * **Name**: Enter a name for your parameter (e.g., "SwiftChatAPIKey", this is `ApiKeyParam` you will fill
      in [Step2](#step-2-deploy-stack-and-get-your-api-url)).
    * **Type**: Select `SecureString`.
    * **Value**: Any string without spaces (This is the `API Key` you'll need to configure your App
      in [Step 3](#step-3-download-the-app-and-setup-with-api-url-and-api-key)).
4. Click **Create parameter**.

### Step 2: Deploy stack and get your API URL

1. Click the following button to launch the CloudFormation Stack in the same region with your API Key just created.
    - App Runner

      [![Launch Stack](assets/launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/template?stackName=SwiftChatAPI&templateURL=https://aws-gcr-solutions.s3.amazonaws.com/swift-chat/latest/SwiftChatAppRunner.template)

    - Lambda (Note: Make sure your AWS account allows public Lambda Function URL)

      [![Launch Stack](assets/launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/template?stackName=SwiftChatLambda&templateURL=https://aws-gcr-solutions.s3.amazonaws.com/swift-chat/latest/SwiftChatLambda.template)

2. Click **Next**, On the "Specify stack details" page, provide the following information:
    - Fill the `ApiKeyParam` with the parameter name you used for storing the API key (e.g., "SwiftChatAPIKey").
    - For App Runner, choose an `InstanceTypeParam` based on your needs.
3. Click **Next**, Keep the "Configure stack options" page as default, Read the Capabilities and Check the "I
   acknowledge that AWS CloudFormation might create IAM resources" checkbox at the bottom.
4. Click **Next**, In the "Review and create" Review your configuration and click **Submit**.

Wait about 3-5 minutes for the deployment to finish, then click the CloudFormation stack and go to **Outputs** tab, you
can find the **API URL** which looks like: `https://xxx.xxx.awsapprunner.com` or `https://xxx.lambda-url.xxx.on.aws`

### Step 3: Download the app and setup with API URL and API Key

1. Download the App
    - Android App click to [Download](https://github.com/aws-samples/swift-chat/releases/download/1.5.0/SwiftChat.apk)
    - macOS App click to [Download](https://github.com/aws-samples/swift-chat/releases/download/1.5.0/SwiftChat.dmg)
    - iOS (Currently we do not provide the iOS version, you can build it locally with Xcode)

2. Launch the App, open the drawer menu, and tap **Settings**.
3. Paste the `API URL` and `API Key` then select the Region.
4. Click the top right ✓ icon to save your configuration and start your chat.

Congratulations 🎉 Your SwiftChat App is ready to use!

### Supported Region

- US East (N. Virginia): us-east-1
- US West (Oregon): us-west-2
- Asia Pacific (Mumbai): ap-south-1
- Asia Pacific (Singapore): ap-southeast-1
- Asia Pacific (Sydney): ap-southeast-2
- Asia Pacific (Tokyo): ap-northeast-1
- Canada (Central): ca-central-1
- Europe (Frankfurt): eu-central-1
- Europe (London): eu-west-2
- Europe (Paris): eu-west-3
- South America (São Paulo): sa-east-1

## Detailed Features

### Message Handling

- [x] Text copy support:
    * Copy button in message header
    * Copy button in code blocks
    * Direct Select and copy code on macOS (double click or long click on iOS)
    * Long press text to copy entire sentence (Right-click on macOS)
- [x] Text selection mode by tapping message title or double-clicking text
- [x] Message timeline view in history
- [x] Delete messages through long press in history
- [x] Click to preview for uploaded documents and images
- [x] Support Markdown format for both questions and answers
- [x] Support table display and code syntax highlighting
- [x] Maximum 20 images and 5 documents per conversation

### Image Features

- [x] Support image generation with Chinese prompts
- [x] View and zoom generated images
- [x] Long press images to save or share
- [x] Automatic image compression to optimize token usage

### User Experience

- [x] Haptic feedback for Android and iOS (can be disabled in Settings)
- [x] Support landscape mode on Android/iOS devices
- [x] Double tap title bar to scroll to top
- [x] Click bottom arrow to view latest messages
- [x] View current session token usage by tapping Chat title
- [x] Check detailed token usage and image generation count in Settings
- [x] In-app upgrade notifications (Android & macOS)

## What Makes SwiftChat Really "Swift"?

🚀 **Fast Launch Speed**

- Thanks to the **AOT** (Ahead of Time) compilation of RN Hermes engine
- Added **lazy loading** of complex components
- App launches instantly and is immediately ready for input

🌐 **Fast Request Speed**

- Speed up end-to-end API requests through **image compression**
- Deploying APIs in the **same region** as Bedrock provides lower latency
- Minimal response payload with **zero parsing** needed for direct display

📱 **Fast Render Speed**

- Using `useMemo` and custom caching to creates secondary cache for session content
- Reduce unnecessary re-renders and speed up streaming messages display
- All UI components are rendered as **native components**

📦 **Fast Storage Speed**

- By using **react-native-mmkv** Messages can be read, stored, and updated **10x faster** than AsyncStorage
- Optimized session content and session list storage structure to accelerates history list display

## App Privacy & Security

- Encrypted API key storage
- Minimal permission requirements
- Local-only data storage
- No user behavior tracking
- No data collection
- Privacy-first approach

## App Build and development

First, clone this repository. All app code is located in the `react-native` folder. Before proceeding, execute the
following command to download dependencies.

```bash
cd react-native && npm i
``` 

### Build for Android

```bash
npm start && npm run android
```

### Build for iOS

```bash
npm start && npm run ios
```

### Build for macOS

1. Modify as `isMac = true` in `/src/App.tsx` and execute `npm start`.
2. Double click `ios/SwiftChat.xcworkspace` to open the project in your Xcode.
3. Change the build destination to `My Mac (Mac Catalyst)` then click the ▶ Run button.

## API Reference

### API Schema

First, please configure you `API URL` and `API Key` like:

```bash
export API_URL=<API URL>
export API_KEY=<API Key>
```

1. `/api/converse`
   ```bash
   curl -N "${API_URL}/api/converse" \
   --header 'Content-Type: application/json' \
   --header "Authorization: Bearer ${API_KEY}" \
   --data '{
     "messages": [
       {
         "role": "user",
         "content": [
           {
             "text": "Hi"
           }
         ]
       }
     ],
     "modelId": "anthropic.claude-3-5-sonnet-20240620-v1:0",
     "region": "us-west-2"
   }'
   ```
   This API is used to implement streaming conversations, and it only returns the text and token usage for display.

   The `messages` under body fully complies with the messages structure specification in Amazon
   Bedrock [converse stream](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/bedrock-runtime/client/converse_stream.html)
   API. You can also add `image` or `document` according to the specification to support multimodal conversations.

2. `/api/image`
   ```bash
   curl "${API_URL}/api/image" \
   --header 'Content-Type: application/json' \
   --header "Authorization: Bearer ${API_KEY}" \
   --data '{
     "prompt": "Beautiful countryside",
     "modelId": "stability.stable-image-core-v1:0",
     "region": "us-west-2",
     "width": "1024",
     "height": "1024"
   }'
   ```
   This API is used to generate images and returns a base64 encoded string of the image.

3. `/api/models`
   ```bash
   curl "${API_URL}/api/models" \
   --header 'Content-Type: application/json' \
   --header 'accept: application/json' \
   --header "Authorization: Bearer ${API_KEY}" \
   --data '{
     "region": "us-west-2"
   }'
   ```
   This API is used to get a list of all streaming-supported text models and image generation models in the specified
   region.

4. `/api/upgrade`
   ```bash
   curl "${API_URL}/api/upgrade" \
   --header 'Content-Type: application/json' \
   --header 'accept: application/json' \
   --header "Authorization: Bearer ${API_KEY}"
   ```
   This API is used to get the new version of SwiftChat for Android and macOS App updates.

### API Code Reference

- Client code: [bedrock-api.ts](/react-native/src/api/bedrock-api.ts)

- Server code: [main.py](server/src/main.py)

## How to upgrade?

### Upgrade App

- **Android** and **macOS**: Navigate to **Settings** Page, if there is a new version, you will find it at the bottom
  of this page, then click the app version to download and install it.
- **iOS**: If a new version is released in the [Release page](https://github.com/aws-samples/swift-chat/releases),
  update your local code, rebuild and install your app by Xcode.

**Note**: After downloading a new version, please check
the [release notes](https://github.com/aws-samples/swift-chat/releases) to see if an API version update is required.

### Upgrade API

- **For AppRunner**: Click and open [App Runner Services](https://console.aws.amazon.com/apprunner/home#/services) page,
  find and open `swiftchat-api`, click top right **Deploy** button.
- **For Lambda**: Click and open [Lambda Services](https://console.aws.amazon.com/lambda/home#/functions), find and open
  your Lambda which start with `SwiftChatLambda-xxx`, click the **Deploy new image** button and click Save.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.

