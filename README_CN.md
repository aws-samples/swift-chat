# SwiftChat — 跨平台 AI 聊天应用

> 🚀 您的个人 AI 助手 — 快速、私有、易于使用

[![GitHub Release](https://img.shields.io/github/v/release/aws-samples/swift-chat)](https://github.com/aws-samples/swift-chat/releases)
[![License](https://img.shields.io/badge/license-MIT--0-green)](LICENSE)

[English](/README.md)

SwiftChat 是一款快速响应的 AI 聊天应用，采用 [React Native](https://reactnative.dev/)
开发，并依托 [Amazon Bedrock](https://aws.amazon.com/bedrock/) 提供强大支持，同时兼容 Ollama、DeepSeek、OpenAI 和 OpenAI
兼容的其他模型供应商。凭借其极简设计理念与坚实的隐私保护措施，该应用在 Android、iOS 和 macOS 平台上实现了实时流式对话、AI
图像生成和语音对话助手功能。

![](assets/promo.avif)

### 新功能 🔥

- 🚀 支持使用 Bedrock API Key 连接 Amazon Bedrock 模型（自 v2.5.0 起）。
- 🚀 支持虚拟试衣功能，自动识别衣服、裤子、鞋子并试穿（自 v2.5.0 起）。
- 🚀 支持 macOS 快捷键操作（自 v2.5.0 起）。
    - 使用 `Shift + Enter`、`Control + Enter` 或 `Option + Enter` 添加换行。
    - 使用 `⌘ + V` 从剪贴板添加图片（截图）、视频或文档。
    - 使用 `⌘ + N` 打开多个 Mac 窗口进行并行操作。
- 支持添加多个 OpenAI Compatible
  模型提供商。您现在可以使用 [Easy Model Deployer](https://github.com/aws-samples/easy-model-deployer)、OpenRouter 或任何
  OpenAI 兼容的模型提供商（自 v2.5.0 起）。
- 支持 Android、iOS 和 Mac 上的暗黑模式（自 v2.4.0 起）。
- 在 Apple 平台上支持 Amazon Nova Sonic 语音对语音功能（自 v2.3.0 起）。

## 📱 快速下载

- [下载 Android 版本](https://github.com/aws-samples/swift-chat/releases/download/2.4.0/SwiftChat.apk)
- [下载 macOS 版本](https://github.com/aws-samples/swift-chat/releases/download/2.4.0/SwiftChat.dmg)
- iOS 版本：目前可通过 Xcode 本地构建使用

## Amazon Bedrock 入门指南

### 前置条件

点击 [Amazon Bedrock 模型访问](https://console.aws.amazon.com/bedrock/home#/modelaccess) 启用您的模型访问权限。

### 配置

您可以选择以下两种配置方法中的一种

<details>
<summary><b>🔧 配置 Bedrock API Key（点击展开）</b></summary>

1. 点击 [Amazon Bedrock 控制台](https://console.aws.amazon.com/bedrock/home#/api-keys/long-term/create) 创建长期 API 密钥。

2. 复制并粘贴 API 密钥到 SwiftChat 设置页面的（Amazon Bedrock -> Bedrock API Key）中。

3. 应用程序将根据您当前选择的区域自动获取最新的模型列表。如果列表中出现多个模型，说明配置成功。

</details>

<details>
<summary><b>🔧 配置 SwiftChat 服务器（点击展开）</b></summary>

### 架构

![](/assets/architecture.avif)

默认情况下，我们使用 **AWS App Runner**，它通常用于托管 Python FastAPI 服务器，提供高性能、可扩展性和低延迟。

或者，我们提供用 **AWS Lambda** 使用 Function URL 替代 App Runner
的选项，以获得更具成本效益的解决方案，如此 [示例](https://github.com/awslabs/aws-lambda-web-adapter/tree/main/examples/fastapi-response-streaming)
所示。

### 步骤 1：设置您的 API 密钥

1. 登录您的 AWS 控制台并右键点击 [Parameter Store](https://console.aws.amazon.com/systems-manager/parameters/) 在新标签页中打开。
2. 检查您是否在 [支持的区域](#支持的区域)，然后点击 **创建参数** 按钮。
3. 填入以下参数，其他选项保持默认：

    - **名称**：输入参数名称（例如 "SwiftChatAPIKey"，将在步骤 2 中用作 `ApiKeyParam`）。

    - **类型**：选择 `SecureString`

    - **值**：输入任何不含空格的字符串（这将是步骤 3 中您的 `API Key`）

4. 点击 **创建参数**。

### 步骤 2：部署堆栈并获取 API URL

1. 点击以下按钮之一在创建 API Key 的同一区域启动 CloudFormation 堆栈。

    - **App Runner**

      [![启动堆栈](assets/launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/template?stackName=SwiftChatAPI&templateURL=https://aws-gcr-solutions.s3.amazonaws.com/swift-chat/latest/SwiftChatAppRunner.template)

    - **Lambda**（注意：仅供 AWS 客户使用）

      [![启动堆栈](assets/launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/template?stackName=SwiftChatLambda&templateURL=https://aws-gcr-solutions.s3.amazonaws.com/swift-chat/latest/SwiftChatLambda.template)

2. 点击 **下一步**，在"指定堆栈详细信息"页面，提供以下信息：
    - 用您存储 API 密钥的参数名称填写 `ApiKeyParam`（例如 "SwiftChatAPIKey"）。
    - 对于 App Runner，根据您的需求选择 `InstanceTypeParam`。
3. 点击 **下一步**，保持"配置堆栈选项"页面为默认，阅读功能并勾选底部的"我确认 AWS CloudFormation 可能会创建 IAM 资源"复选框。
4. 点击 **下一步**，在"审核并创建"中检查您的配置并点击 **提交**。

等待约 3-5 分钟完成部署，然后点击 CloudFormation 堆栈并转到 **输出** 选项卡，您可以找到类似
`https://xxx.xxx.awsapprunner.com` 或 `https://xxx.lambda-url.xxx.on.aws` 的 **API URL**。

### 步骤 3：打开应用并使用 API URL 和 API Key 进行设置

1. 启动应用，打开抽屉菜单，点击 **设置**。
2. 粘贴 `API URL` 和 `API Key`（您在 Parameter Store 中输入的 **值**）到 Amazon Bedrock -> SwiftChat Server 下，然后选择您的区域。
3. 点击右上角 ✓ 图标保存配置并开始聊天。

恭喜 🎉 您的 SwiftChat 应用已准备就绪！

### 支持的区域

- 美国东部（弗吉尼亚北部）：us-east-1
- 美国西部（俄勒冈）：us-west-2
- 亚太地区（孟买）：ap-south-1
- 亚太地区（新加坡）：ap-southeast-1
- 亚太地区（悉尼）：ap-southeast-2
- 亚太地区（东京）：ap-northeast-1
- 加拿大（中部）：ca-central-1
- 欧洲（法兰克福）：eu-central-1
- 欧洲（伦敦）：eu-west-2
- 欧洲（巴黎）：eu-west-3
- 南美洲（圣保罗）：sa-east-1

</details>

## 其他模型提供商入门指南

### Ollama

<details>
<summary><b>🔧 配置 Ollama（点击展开）</b></summary>

1. 导航到 **设置页面** 并选择 **Ollama** 选项卡。
2. 输入您的 Ollama 服务器 URL。例如：
    ```bash
    http://localhost:11434
    ```
3. 输入您的 Ollama 服务器 API 密钥（可选）。

4. 输入正确的服务器 URL 后，您可以从 **Chat Model** 下拉列表中选择所需的 Ollama 模型。

</details>

### DeepSeek

<details>
<summary><b>🔧 配置 DeepSeek（点击展开）</b></summary>

1. 前往 **设置页面** 并选择 **DeepSeek** 选项卡。
2. 输入您的 DeepSeek API 密钥。
3. 从 **Chat Model** 下拉列表中选择 DeepSeek 模型。目前支持以下 DeepSeek 模型：
    - `DeepSeek-V3`
    - `DeepSeek-R1`

</details>

### OpenAI

<details>
<summary><b>🔧 配置 OpenAI（点击展开）</b></summary>

1. 导航到 **设置页面** 并选择 **OpenAI** 选项卡。
2. 输入您的 OpenAI API 密钥。
3. 从 **Chat Model** 下拉列表中选择 OpenAI 模型。目前支持以下 OpenAI 模型：
    - `GPT-4o`
    - `GPT-4o mini`
    - `GPT-4.1`
    - `GPT-4.1 mini`
    - `GPT-4.1 nano`

此外，如果您已部署并配置了 [SwiftChat 服务器](#amazon-bedrock-入门指南)，可以启用 **Use Proxy** 选项来转发您的请求。

</details>

### OpenAI Compatible

<details>
<summary><b>🔧 配置 OpenAI Compatible 模型（点击展开）</b></summary>

1. 导航到 **设置页面** 并选择 **OpenAI** 选项卡。
2. 在 **OpenAI Compatible** 下，输入以下信息：
    - 您的模型提供商的 `Base URL`
    - 您的模型提供商的 `API Key`
    - 您想使用的模型的 `Model ID`（用逗号分隔多个模型）
3. 从 **Chat Model** 下拉列表中选择您的一个模型。
4. 点击右侧的加号按钮添加另一个 OpenAI 兼容的模型提供商。您最多可以添加 10 个 OpenAI 兼容的模型提供商。

</details>

## 主要功能

- 与 AI 进行实时流式聊天
- 丰富的 Markdown 支持：表格、代码块、LaTeX 等
- 带进度显示的 AI 图像生成
- 多模态支持（图像、视频和文档）
- 对话历史列表查看和管理
- 跨平台支持（Android、iOS、macOS）
- 针对 iPad 和 Android 平板电脑优化
- 快速启动和响应性能
- 支持多种 AI
  模型（[Amazon Bedrock](https://aws.amazon.com/bedrock/)、[Ollama](https://github.com/ollama/ollama)、[DeepSeek](https://www.deepseek.com/)、[OpenAI](https://openai.com/)
  和 [OpenAI Compatible](#openai-compatible) 模型）
- 完全可自定义的系统提示词助手

### 功能展示

**全面的多模态分析**：文本、图像、文档和视频

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/text_streaming.avif" width=24%>
<img src="assets/animations/image_summary.avif" width=24%>
<img src="assets/animations/doc_summary.avif" width=24%>
<img src="assets/animations/video_summary.avif" width=24%>
</div>

**创意图像套件**：生成、虚拟试衣、风格复制、背景移除，由 Nova Canvas 提供支持

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/gen_image.avif" width=24%>
<img src="assets/animations/virtual_try_on.avif" width=24%>
<img src="assets/animations/similar_style.avif" width=24%>
<img src="assets/animations/remove_background.avif" width=24%>
</div>

**系统提示词助手**：有用的预设系统提示词，具备完整管理功能（添加/编辑/排序/删除）

![](assets/animations/english_teacher.avif)

**丰富的 Markdown 支持**：段落、代码块、表格、LaTeX 等

![](assets/markdown.avif)

我们重新设计了 UI，优化了字体大小和行间距，提供更优雅、清洁的展示效果。
所有这些功能也在 Android 和 macOS 上以原生 UI 无缝显示

#### 暗黑模式

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/dark_markdown.avif" width=24%>
<img src="assets/animations/dark_voice.avif" width=24%>
<img src="assets/animations/dark_gen_image.avif" width=24%>
<img src="assets/animations/dark_settings.avif" width=24%>
</div>

> 注意：为了演示效果，一些动图已加速。如果您遇到卡顿，请在电脑上使用 Chrome、Firefox 或 Edge 浏览器查看。

### Amazon Nova 系列功能

#### Nova Canvas 简易虚拟试衣功能

1. 支持自动设置主图像，默认为之前使用的主图像。
2. 支持上传或拍摄第二张图像并直接发送，无需任何提示词。
3. 支持自动识别衣服、裤子、鞋子并进行试穿

#### Amazon Nova Sonic 语音对语音模型

1. 内置单词和句子的口语练习，以及讲故事场景。您也可以添加 **自定义系统提示词** 用于不同场景的语音聊天。
2. 默认支持 **插话功能**，您也可以在系统提示词中禁用。
3. 支持在设置页面中选择语音，包括美式/英式英语、西班牙语以及男性和女性语音选项。
4. 支持 **回声消除**，您可以直接对着设备说话而无需佩戴耳机。
5. 支持 **语音波形** 显示音量级别。

**学习句子**

https://github.com/user-attachments/assets/ebf21b12-9c93-4d2e-a109-1d6484019838

**Mac 上讲故事（带插话功能）**

https://github.com/user-attachments/assets/c70fc2b4-8960-4a5e-b4f8-420fcd5eafd4

> 注意：Amazon Nova Sonic 目前仅在 SwiftChat 服务器中可用。

#### 其他功能

- 直接在 Android 和 iOS 上录制 30 秒视频供 Nova 分析
- 上传超过 8MB 的大视频（1080p/4K）并自动压缩
- 支持使用默认模板让 Nova Canvas 生成图像、移除背景和创建相似风格的图像。

## 详细功能

**快速访问工具**：代码和内容复制、选择模式、模型切换、重新生成、滚动控制和令牌计数器

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/copy.avif" width=32%>
<img src="assets/animations/regenerate.avif" width=32%>
<img src="assets/animations/scroll_token.avif" width=32%>
</div>

我们拥有简洁的聊天历史、设置页面和直观的使用统计页面：

![](assets/history_settings_zh.avif)

### 消息处理

- [x] 文本复制支持：
    - 消息底部的复制按钮，或直接点击模型名称或用户标题部分。
    - 代码块中的复制按钮
    - 推理块中的复制按钮
    - macOS 上直接选择并复制代码（iOS 上双击或长按）
    - 长按文本复制整个句子（macOS 上右击）
- [x] 点击选择按钮启用文本选择模式。
- [x] 历史记录中的消息时间线视图
- [x] 在历史记录中长按删除消息
- [x] 点击预览文档、视频和图像
- [x] 支持折叠和展开推理部分并记住最近状态

### 图像功能

- [x] 支持使用中文提示生成图像（确保在您选择的区域启用了 `Amazon Nova Lite`）
- [x] 长按图像保存或分享
- [x] 自动图像压缩以提高响应速度

### 用户体验

- [x] Android 和 iOS 触觉反馈（可在设置中禁用）
- [x] 支持 Android/iOS 设备横屏模式
- [x] 双击标题栏滚动到顶部
- [x] 点击底部箭头查看最新消息
- [x] 点击聊天标题再次显示系统提示词和模型切换图标
- [x] 双击聊天标题查看当前会话令牌使用情况
- [x] 在设置中查看详细令牌使用情况和图像生成计数
- [x] 应用内升级通知（Android 和 macOS）

我们针对横屏模式优化了布局。如下所示，您可以在横屏方向舒适地查看表格/代码内容。

![](assets/animations/landscape.avif)

### YouTube 视频

[<img src="./assets/youtube.avif">](https://www.youtube.com/watch?v=rey05WzfEbM)
> 视频中的内容是早期版本。对于 UI、架构和不一致之处，请参考当前文档。

## 什么让 SwiftChat 真正"Swift"？

🚀 **快速启动速度**

- 得益于 RN Hermes 引擎的 **AOT**（提前编译）
- 添加了复杂组件的 **延迟加载**
- 应用瞬间启动，立即可输入

🌐 **快速请求速度**

- 通过 **图像压缩** 加速端到端 API 请求
- 在与 Bedrock **相同区域** 部署 API 提供更低延迟

📱 **快速渲染速度**

- 使用 `useMemo` 和自定义缓存为会话内容创建二级缓存
- 减少不必要的重新渲染并加速流式消息显示
- 所有 UI 组件都渲染为 **原生组件**

📦 **快速存储速度**

- 通过使用 **react-native-mmkv** 消息可以比 AsyncStorage **快 10 倍** 读取、存储和更新
- 优化会话内容和会话列表存储结构以加速历史列表显示

## 应用隐私与安全

- 加密的 API 密钥存储
- 最小权限要求
- 仅本地数据存储
- 无用户行为跟踪
- 无数据收集
- 隐私优先方针

## 应用构建和开发

首先，克隆此存储库。所有应用代码位于 `react-native` 文件夹中。在继续之前，执行以下命令下载依赖项。

```bash
cd react-native && npm i && npm start
```

### 构建 Android

打开新终端并执行：

```bash
npm run android
```

### 构建 iOS

同样打开新终端。首次运行需要执行 `cd ios && pod install && cd ..` 安装原生依赖，然后执行以下命令：

```bash
npm run ios
```

### 构建 macOS

1. 执行 `npm start`。
2. 双击 `ios/SwiftChat.xcworkspace` 在 Xcode 中打开项目。
3. 将构建目标更改为 `My Mac (Mac Catalyst)` 然后点击 ▶ 运行按钮。

## API 参考

请参考 [API 参考](server/README.md)

## 如何升级？

### 升级应用

- **Android** 和 **macOS**：导航到 **设置** 页面，如果有新版本，您将在此页面底部找到它，然后点击应用版本下载并安装。
- **iOS**：如果在 [发布页面](https://github.com/aws-samples/swift-chat/releases) 发布了新版本，请更新您的本地代码，通过
  Xcode 重新构建并安装您的应用。

**注意**：下载新版本后，请查看 [发布说明](https://github.com/aws-samples/swift-chat/releases) 确认是否需要 API 版本更新。

### 升级 API

- **对于 AppRunner**：点击打开 [App Runner 服务](https://console.aws.amazon.com/apprunner/home#/services) 页面，找到并打开
  `swiftchat-api`，点击右上角 **部署** 按钮。
- **对于 Lambda**：点击打开 [Lambda 服务](https://console.aws.amazon.com/lambda/home#/functions) 页面，找到并打开以
  `SwiftChatLambda-xxx` 开头的 Lambda，点击 **部署新镜像** 按钮并点击保存。

## 安全

更多信息请参见 [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications)。

## 许可证

此库使用 MIT-0 许可证。详见 [LICENSE](LICENSE) 文件。
