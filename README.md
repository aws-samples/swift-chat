# SwiftChat — A Cross-platform AI Chat App

> 🚀 Your Personal AI Assistant — Fast, Private, and Easy to use

[![GitHub Release](https://img.shields.io/github/v/release/aws-samples/swift-chat)](https://github.com/aws-samples/swift-chat/releases)
[![License](https://img.shields.io/badge/license-MIT--0-green)](LICENSE)

[中文](/README_CN.md)

SwiftChat is a fast and responsive AI chat application developed with [React Native](https://reactnative.dev/) and
powered by [Amazon Bedrock](https://aws.amazon.com/bedrock/), with compatibility extending to other model providers such
as Ollama, DeepSeek, OpenAI and OpenAI Compatible. With its minimalist design philosophy and robust privacy protection,
it delivers real-time streaming conversations, AI image generation and voice conversation assistant capabilities
across Android, iOS, and macOS platforms.

![](assets/promo.avif)

### What's New 🔥
- 🚀 Support streaming rendering of Mermaid charts (From v2.6.0).
   <div style="display: flex; flex-direction: 'row'; background-color: #888888;">
   <img src="assets/animations/mermaid_en.avif" width=48%>
   <img src="assets/animations/mermaid_save_en.avif" width=48%>
   </div>
- 🚀 Support using Bedrock API Key for Amazon Bedrock models (From v2.5.0).
- 🚀 Support virtual try-on, automatically recognize clothes, pants, shoes and try them on (From v2.5.0).
- 🚀 Support shortcuts for macOS (From v2.5.0).
    - Use `Shift + Enter`, `Control + Enter` or `Option + Enter` to add a line break.
    - Use `⌘ + V` to add images (Screenshot), videos, or documents from your clipboard.
    - Use `⌘ + N` to opening multiple Mac windows for parallel operations.

## 📱 Quick Download

- [Download for Android](https://github.com/aws-samples/swift-chat/releases/download/2.6.0/SwiftChat.apk)
- [Download for macOS](https://github.com/aws-samples/swift-chat/releases/download/2.6.0/SwiftChat.dmg)
- For iOS: Currently available through local build with Xcode

## Getting Started with Amazon Bedrock

### Prerequisites

Click [Amazon Bedrock Model access](https://console.aws.amazon.com/bedrock/home#/modelaccess) to enable your models
access.

### Configuration

You can choose one of the following two methods for configuration

<details>
<summary><b>🔧 Configure Bedrock API Key (Click to expand)</b></summary>

1. Click [Amazon Bedrock Console](https://console.aws.amazon.com/bedrock/home#/api-keys/long-term/create) to create a
   long-term API
   key.

2. Copy and paste the API key to the (Amazon Bedrock -> Bedrock API Key) under SwiftChat Settings page.

3. The App will automatically get the latest model list based on the region you currently selected. If multiple models
   appear in the list, it means the configuration is successful.

</details>

<details>
<summary><b>🔧 Configure SwiftChat Server (Click to expand)</b></summary>

### Architecture

![](/assets/architecture.avif)

By default, we use **AWS App Runner**, which is commonly used to host Python FastAPI servers, offering high performance,
scalability and low latency.

Alternatively, we provide the option to replace App Runner with **AWS Lambda** using Function URL for a more
cost-effective
solution, as shown in
this [example](https://github.com/awslabs/aws-lambda-web-adapter/tree/main/examples/fastapi-response-streaming).

### Step 1: Set up your API Key

1. Sign in to your AWS console and
   right-click [Parameter Store](https://console.aws.amazon.com/systems-manager/parameters/) to open it in a new tab.
2. Check whether you are in the [supported region](#supported-region), then click on the **Create parameter** button.
3. Fill in the parameters below, leaving other options as default:

    - **Name**: Enter a parameter name (e.g., "SwiftChatAPIKey", will be used as `ApiKeyParam` in Step 3).

    - **Type**: Select `SecureString`

    - **Value**: Enter any string without spaces.(this will be your `API Key` in Step 4)

4. Click **Create parameter**.

### Step 2: Build and push container images to ECR

1. Clone this repository:
   ```bash
   git clone https://github.com/aws-samples/swift-chat.git
   cd swift-chat
   ```

2. Run the build and push script:
   ```bash
   cd server/scripts
   bash ./push-to-ecr.sh
   ```

3. Follow the prompts to configure:
   - ECR repository name (or use default: `swift-chat-api`)
   - Image tag (please use default: `latest`)
   - AWS region (the region you want to deploy, e.g.,: `us-east-1`)
   - Deployment type:
     - Option 1 (default): **AppRunner** - uses amd64 architecture
     - Option 2: **Lambda** - uses arm64 architecture

4. The script will build and push the Docker image to your ECR repository.

5. **Important**: Copy the image URI displayed at the end of the script output. You'll need this in the next step.

### Step 3: Deploy stack and get your API URL

1. Download the CloudFormation template you want to use:
   - For App Runner: [SwiftChatAppRunner.template](https://github.com/aws-samples/swift-chat/blob/main/server/template/SwiftChatAppRunner.template)
   - For Lambda: [SwiftChatLambda.template](https://github.com/aws-samples/swift-chat/blob/main/server/template/SwiftChatLambda.template)

2. Go to [CloudFormation Console](https://console.aws.amazon.com/cloudformation/home#/stacks/create/template?stackName=SwiftChatAPI) and select **Upload a template file** under **Specify template**, then upload the template file you downloaded. (Make sure you are in the same region where your API Key was created.)

3. Click **Next**, On the "Specify stack details" page, provide the following information:
    - **Stack name**: Keep the default "SwiftChatAPI" or change if needed
    - **ApiKeyParam**: Enter the parameter name you used for storing the API key (e.g., "SwiftChatAPIKey")
    - **ContainerImageUri**: Enter the ECR image URI from Step 2 output
    - For App Runner, choose an **InstanceTypeParam** based on your needs

4. Click **Next**, Keep the "Configure stack options" page as default, Read the Capabilities and Check the "I
   acknowledge that AWS CloudFormation might create IAM resources" checkbox at the bottom.
5. Click **Next**, In the "Review and create" Review your configuration and click **Submit**.

Wait about 3–5 minutes for the deployment to finish, then click the CloudFormation stack and go to **Outputs** tab, you
can find the **API URL** which looks like: `https://xxx.xxx.awsapprunner.com` or `https://xxx.lambda-url.xxx.on.aws`

### Step 4: Open the App and setup with API URL and API Key

1. Launch the App, open the drawer menu, and tap **Settings**.
2. Paste the `API URL` and `API Key`(The **Value** you typed in Parameter Store) Under Amazon Bedrock -> SwiftChat
   Server, then select your Region.
3. Click the top right ✓ icon to save your configuration and start your chat.

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

</details>

## Getting Started with Other Model Providers

### Ollama

<details>
<summary><b>🔧 Configure Ollama (Click to expand)</b></summary>

1. Navigate to the **Settings Page** and select the **Ollama** tab.
2. Enter your Ollama Server URL. For example:
    ```bash
    http://localhost:11434
    ```
3. Enter your Ollama Server API Key (Optional).

4. Once the correct Server URL is entered, you can select your desired Ollama models from the **Chat Model** dropdown
   list.

</details>

### DeepSeek

<details>
<summary><b>🔧 Configure DeepSeek (Click to expand)</b></summary>

1. Go to the **Settings Page** and select the **DeepSeek** tab.
2. Input your DeepSeek API Key.
3. Choose DeepSeek models from the **Chat Model** dropdown list. Currently, the following DeepSeek models are supported:
    - `DeepSeek-V3`
    - `DeepSeek-R1`

</details>

### OpenAI

<details>
<summary><b>🔧 Configure OpenAI (Click to expand)</b></summary>

1. Navigate to the **Settings Page** and select the **OpenAI** tab.
2. Enter your OpenAI API Key.
3. Select OpenAI models from the **Chat Model** dropdown list. The following OpenAI models are currently supported:
    - `GPT-4o`
    - `GPT-4o mini`
    - `GPT-4.1`
    - `GPT-4.1 mini`
    - `GPT-4.1 nano`
    - `GPT-5`
    - `GPT-5 chat`
    - `GPT-5 mini`
    - `GPT-5 nano`

Additionally, if you have deployed and configured the [SwiftChat Server](#getting-started-with-amazon-bedrock), you
can enable the **Use Proxy** option to forward your requests.

</details>

### OpenAI Compatible

<details>
<summary><b>🔧 Configure OpenAI Compatible models (Click to expand)</b></summary>

1. Navigate to the **Settings Page** and select the **OpenAI** tab.
2. Under **OpenAI Compatible**, enter the following information:
    - `Base URL` of your model provider
    - `API Key` of your model provider
    - `Model ID` of the models you want to use (separate multiple models with commas)
3. Select one of your models from the **Chat Model** dropdown list.
4. Click the plus button on the right to add another OpenAI-compatible model provider. You can add up to 10
   OpenAI-compatible model providers.

</details>

## Key Features

- Real-time streaming chat with AI
- Rich Markdown Support: Tables, Code Blocks, LaTeX, Mermaid Chart and More
- AI image generation with progress
- Multimodal support (images, videos & documents)
- Conversation history list view and management
- Cross-platform support (Android, iOS, macOS)
- Tablet-optimized for iPad and Android tablets
- Fast launch and responsive performance
- Multiple AI models
  supported ([Amazon Bedrock](https://aws.amazon.com/bedrock/), [Ollama](https://github.com/ollama/ollama), [DeepSeek](https://www.deepseek.com/), [OpenAI](https://openai.com/)
  and [OpenAI Compatible](#openai-compatible) Models)
- Fully Customizable System Prompt Assistant

### Feature Showcase

**Comprehensive Multimodal Analysis**: Text, Image, Document and Video

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/text_streaming.avif" width=24%>
<img src="assets/animations/image_summary.avif" width=24%>
<img src="assets/animations/doc_summary.avif" width=24%>
<img src="assets/animations/video_summary.avif" width=24%>
</div>

**Creative Image Suite**: Generation, Virtual try-on, Style Replication, Background Removal with Nova Canvas

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/gen_image.avif" width=24%>
<img src="assets/animations/virtual_try_on_demo.avif" width=24%>
<img src="assets/animations/similar_style.avif" width=24%>
<img src="assets/animations/remove_background.avif" width=24%>
</div>

**System Prompt Assistant**: Useful Preset System Prompts with Full Management Capabilities (Add/Edit/Sort/Delete)

![](assets/animations/english_teacher.avif)

**Rich Markdown Support**: Paragraph, Code Blocks, Tables, LaTeX and More

![](assets/markdown.avif)

We redesigned the UI with optimized font sizes and line spacing for a more elegant and clean presentation.
All of these features are also seamlessly displayed on Android and macOS with native UI

#### Dark Mode

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/dark_markdown.avif" width=24%>
<img src="assets/animations/dark_voice.avif" width=24%>
<img src="assets/animations/dark_gen_image.avif" width=24%>
<img src="assets/animations/dark_settings.avif" width=24%>
</div>

> Note: Some animated images have been sped up for demonstration. If you experience lag, please view on Chrome, Firefox,
> or Edge browser on your computer.

### Amazon Nova Series Features

#### Easy to use Virtual try-on by Nova Canvas

1. Support automatic setting of the main image, default is the previously used main image.
2. Support uploading or taking the second image and sending it directly without any prompt words.
3. Support automatically recognizes clothes, pants, shoes and tries them on

#### Amazon Nova Sonic Speech to Speech Model

1. Built-in spoken language practice for words and sentences, as well as storytelling scenarios. You can also add
   **Custom System Prompts** for voice chatting in different scenarios.
2. Support **Barge In** by default, Also you can disable in system prompt.
3. Support selecting voices in the settings page, including American/British English, Spanish and options for male and
   female voices.
4. Support **Echo Cancellation**, You can talk directly to the device without wearing headphones.
5. Support **Voice Waveform** to display volume level.

**Learn Sentences**

https://github.com/user-attachments/assets/ebf21b12-9c93-4d2e-a109-1d6484019838

**Telling Story on Mac (With barge in feature)**

https://github.com/user-attachments/assets/c70fc2b4-8960-4a5e-b4f8-420fcd5eafd4

> Note: Amazon Nova Sonic currently only available with SwiftChat server.

#### Other Features

- Record 30-second videos directly on Android and iOS for Nova analysis
- Upload large videos (1080p/4K) beyond 8MB with auto compression
- Support using default template to make Nova Canvas generate images, remove backgrounds, and
  create images in similar styles.

## Detailed Features

**Quick Access Tools**: Code & Content Copy, Selection Mode, Model Switch, Regenerate, Scroll Controls and Token Counter

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/copy.avif" width=32%>
<img src="assets/animations/regenerate.avif" width=32%>
<img src="assets/animations/scroll_token.avif" width=32%>
</div>

We feature streamlined chat History, Settings pages, and intuitive Usage statistics:

![](assets/history_settings.avif)

### Message Handling

- [x] Text copy support:
    - Copy button at the bottom of messages, or directly click the model name or user title section.
    - Copy button in code blocks
    - Copy button in reasoning blocks
    - Direct Select and copy code on macOS (double-click or long click on iOS)
    - Long press text to copy the entire sentence (Right-click on macOS)
- [x] Text selection mode by click selection button.
- [x] Message timeline view in history
- [x] Delete messages through long press in history
- [x] Click to preview for documents videos and images
- [x] Support for collapsing and expanding the reasoning section and remembering the most recent state

### Image Features

- [x] Support image generation with Chinese prompts (Make sure `Amazon Nova Lite` is enabled in your selected region)
- [x] Long press images to save or share
- [x] Automatic image compression to improve response speed

### User Experience

- [x] Haptic feedback for Android and iOS (can be disabled in Settings)
- [x] Support landscape mode on Android/iOS devices
- [x] Double tap title bar to scroll to top
- [x] Click bottom arrow to view the latest messages
- [x] Display system prompt and model switch icon again by clicking on the chat title
- [x] View current session token usage by tapping twice Chat title
- [x] Check detailed token usage and image generation count in Settings
- [x] In-app upgrade notifications (Android & macOS)

We have optimized the layout for landscape mode. As shown below, you can comfortably view table/code contents in
landscape orientation.

![](assets/animations/landscape.avif)

### YouTube Video

[<img src="./assets/youtube.avif">](https://www.youtube.com/watch?v=rey05WzfEbM)
> The content in the video is an early version. For UI, architecture, and inconsistencies, please refer to the current
> documentation.

## What Makes SwiftChat Really "Swift"?

🚀 **Fast Launch Speed**

- Thanks to the **AOT** (Ahead of Time) compilation of RN Hermes engine
- Added **lazy loading** of complex components
- App launches instantly and is immediately ready for input

🌐 **Fast Request Speed**

- Speed up end-to-end API requests through **image compression**
- Deploying APIs in the **same region** as Bedrock provides lower latency

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

## App Build and Development

First, clone this repository. All app code is located in the `react-native` folder. Before proceeding, execute the
following command to download dependencies.

```bash
cd react-native && npm i && npm start
```

### Build for Android

open a new terminal and execute:

```bash
npm run android
```

### Build for iOS

Also open a new terminal. For the first time you need to install the native dependencies
by execute `cd ios && pod install && cd ..`, then execute the follow command:

```bash
npm run ios
```

### Build for macOS

1. Execute `npm start`.
2. Double click `ios/SwiftChat.xcworkspace` to open the project in your Xcode.
3. Change the build destination to `My Mac (Mac Catalyst)` then click the ▶ Run button.

## API Reference

Please refer [API Reference](server/README.md)

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
