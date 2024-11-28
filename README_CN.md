[English](/README.md)

# SwiftChat - 跨平台 AI 聊天应用

SwiftChat是一个使用 [React Native](https://reactnative.dev/) 构建并由 [Amazon Bedrock](https://aws.amazon.com/bedrock/)
提供支持的快速响应式AI聊天应用。它采用极简设计理念和强大的隐私保护，提供实时流式对话和AI图像生成功能，支持 Android、iOS 和
macOS 等多个平台。

![](assets/promo.png)

**主要特点:**

- 与 AI 进行实时流式聊天
- 带进度的 AI 图像生成
- 多模态支持（相机拍照、图片选择和文档上传）
- 对话历史记录列表查看和管理
- 跨平台支持（Android、iOS、macOS）
- 针对 iPad 和 Android 平板电脑优化
- 快速启动和响应性能
- 支持多种 AI 模型及切换

## 架构

![](/assets/architecture.png)

默认情况下，我们使用 AWS App Runner（通常用于托管 Python FastAPI 服务器），提供高性能、可扩展性和低延迟。

另外，我们提供使用 AWS Lambda 的 Function URL 替代 App Runner
的选项，以获得更具成本效益的解决方案，如 [示例](https://github.com/awslabs/aws-lambda-web-adapter/tree/main/examples/fastapi-response-streaming)
所示。

## 入门指南

### 前置条件

请确保您有权限访问 Amazon Bedrock 基础模型，SwiftChat 默认设置如下：

* 区域: `us-west-2`
* 文本模型: `Claude 3.5 Sonnet`
* 图像模型: `Stable Image Core 1.0`

您可以参考 [Amazon Bedrock 用户指南](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access-modify.html)
来启用你的模型。

### 第1步: 设置API Key

1. 右键点击 [Parameter Store](https://console.aws.amazon.com/systems-manager/parameters/) 在新窗口中打开 AWS 控制台。
2. 检查您是否在 [支持的区域](#支持的区域)，然后点击 **创建参数** 按钮。
3. 完成以下参数填写，其他选项保持默认：
    * **名称**：为您的参数输入描述性名称(例如 "SwiftChatAPIKey"，这是您将在 [第2步](#第2步-部署堆栈并获取api-url)
      中填写的`ApiKeyParam`)。
    * **类型**：选择 `SecureString`。
    * **值**：任何不含空格的字符串（这是您需要在 [第3步](#第3步-下载应用并设置-api-url-和-api-key) 中配置 App
      的 `API Key`）。
4. 点击 **创建参数**。

### 第2步: 部署堆栈并获取API URL

1. 点击以下按钮在与刚才创建的 API Key 相同的区域启动 CloudFormation 堆栈。
    - App Runner

      [![启动堆栈](assets/launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/template?stackName=SwiftChatAPI&templateURL=https://aws-gcr-solutions.s3.amazonaws.com/swift-chat/latest/SwiftChatAppRunner.template)

    - Lambda (提示：请确保你的 AWS 账户允许公开 Lambda Function URL)

      [![启动堆栈](assets/launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/template?stackName=SwiftChatLambda&templateURL=https://aws-gcr-solutions.s3.amazonaws.com/swift-chat/latest/SwiftChatLambda.template)

2. 点击 **下一步**，在"指定堆栈详细信息"页面中提供以下信息:
    - 使用存储 API Key 的参数名填写`ApiKeyParam`(例如"SwiftChatAPIKey")。
    - 对于App Runner，根据您的需求选择`InstanceTypeParam`。
3. 点击 **下一步**，保持 "配置堆栈选项" 页面默认设置，阅读功能并勾选底部的 "我确认，AWS CloudFormation可能会创建 IAM 资源"
   复选框。
4. 点击 **下一步**，在 "审核并创建" 中检查配置并点击 **提交**。

等待约3-5分钟部署完成，然后点击CloudFormation堆栈并转到 **输出** 选项卡，您可以找到 **API URL**
类似`https://xxx.xxx.awsapprunner.com` 或 `https://xxx.lambda-url.xxx.on.aws`。

### 第3步: 下载应用并设置 API URL 和 API Key

1. 下载应用
    - Android 应用点击 [下载](https://github.com/aws-samples/swift-chat/releases/download/1.5.0/SwiftChat.apk)
    - macOS 应用点击 [下载](https://github.com/aws-samples/swift-chat/releases/download/1.5.0/SwiftChat.dmg)
    - iOS (目前不提供 iOS 版本，您可以使用 Xcode 在本地构建)

2. 启动应用，点击左侧菜单按钮，并点击底部的 **Settings**。
3. 粘贴`API URL`和`API Key`然后选择 Region。
4. 点击右上角✓图标保存配置并开始聊天。

恭喜🎉 您的 SwiftChat 应用已准备就绪!

### 支持的区域

- 美国东部(弗吉尼亚北部):us-east-1
- 美国西部(俄勒冈):us-west-2
- 亚太地区(孟买):ap-south-1
- 亚太地区(新加坡):ap-southeast-1
- 亚太地区(悉尼):ap-southeast-2
- 亚太地区(东京):ap-northeast-1
- 加拿大(中部):ca-central-1
- 欧洲(法兰克福):eu-central-1
- 欧洲(伦敦):eu-west-2
- 欧洲(巴黎):eu-west-3
- 南美洲(圣保罗):sa-east-1

## 详细功能

### 消息处理

- [x] 文本复制支持：
    * 点击消息标题栏右侧的复制按钮
    * 点击代码块右上角的复制按钮
    * 在 macOS 上可直接选择并复制代码（iOS 上双击或长按）
    * 长按文本复制整句（macOS 上点击右键）
- [x] 通过点击消息标题或双击文本启用文本选择模式
- [x] 历史消息按时间线展示
- [x] 在历史记录中长按可删除消息
- [x] 点击预览上传的文档和图片
- [x] 同时支持问题和回答的 Markdown 格式显示
- [x] 支持表格显示和代码语法高亮
- [x] 每个会话最多支持上传 20 张图片和 5 个文档

### 图片功能

- [x] 支持使用中文生成图片
- [x] 支持点击查看和缩放生成的图片
- [x] 长按图片可保存或分享
- [x] 自动压缩上传图片以优化 token 使用

### 用户体验

- [x] Android 和 iOS 设备支持触感反馈（可在设置中关闭）
- [x] 支持 Android/iOS 设备横屏模式
- [x] 双击标题栏回到顶部
- [x] 点击底部箭头查看最新消息
- [x] 点击聊天标题查看当前会话的 token 使用情况
- [x] 在设置中查看详细的 token 使用情况和图片生成数量
- [x] 应用内升级提示（Android 和 macOS）

## 是什么让 SwiftChat 如此"迅速"?

🚀 **快速启动速度**

- 得益于RN Hermes 引擎的 **AOT**（提前编译）
- 实现了复杂组件的 **延迟加载**
- 支持**应用秒开**，启动后可直接输入

🌐 **快速请求速度**

- 通过**图像压缩**加速端到端 API 请求
- 在与 Bedrock **相同区域**部署 API 以提供更低延迟
- 最小响应有效负载，**零解析**直接显示

📱 **快速渲染速度**

- 使用`useMemo`和自定义缓存为会话内容创建二级缓存
- 减少不必要的重新渲染并加快流式消息显示
- 所有 UI 组件都渲染为**原生组件**

📦 **快速存储速度**

- 通过使用 **react-native-mmkv** 消息可以比 AsyncStorage **快10倍**读取、存储和更新
- 优化会话内容和会话列表存储结构以加快历史记录列表显示

## 应用隐私和安全

- 加密 API Key 的存储
- 最小权限要求
- 数据仅本地存储
- 无用户行为跟踪
- 无数据收集
- 隐私优先策略

## 构建和开发

首先，克隆此仓库。所有 App 代码位于 react-native 文件夹中。在继续之前，请执行以下命令来下载依赖项。

```bash
cd react-native && npm i
``` 

### 构建 Android

```bash
npm start && npm run android
```

## 构建 iOS

```bash
npm start && npm run ios
```

### 构建 macOS

1. 在 `/src/App.tsx` 中将 `isMac` 修改为 `true` 并执行 `npm start`。
2. 双击 `ios/SwiftChat.xcworkspace` 在 Xcode 中打开项目。
3. 将构建目标更改为 `My Mac (Mac Catalyst)` 然后点击 ▶ 运行按钮。

## API 参考

### API 格式

首先，请配置您的 `API URL` 和 `API Key`:

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
   此 API 用于实现流式对话，它仅返回显示所需的文本和 Token 用量。

   Body 中的 `messages` 完全符合 Amazon
   Bedrock [converse stream](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/bedrock-runtime/client/converse_stream.html)
   API 中的消息结构规范。您还可以根据规范添加 `image` 或 `document` 以支持多模态对话。

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
   此 API 用于生成图像并返回图像的 base64 编码字符串。

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
   此 API 用于获取指定区域中所有支持流式传输的文本模型和图像生成模型的列表。

4. `/api/upgrade`
   ```bash
   curl "${API_URL}/api/upgrade" \
   --header 'Content-Type: application/json' \
   --header 'accept: application/json' \
   --header "Authorization: Bearer ${API_KEY}"
   ```
   此 API 用于获取 SwiftChat 新版本，以支持 Android 和 macOS App 更新功能。

### API 代码参考

- 客户端代码: [bedrock-api.ts](/react-native/src/api/bedrock-api.ts)

- 服务器代码: [main.py](server/src/main.py)

## 如何升级？

### 升级应用程序

- **Android** 和 **macOS**：导航到 **Settings** 页面，如果有新版本，您将在页面底部找到它，然后点击应用版本号进行下载和安装。
- **iOS**：如果在 [Release页面](https://github.com/aws-samples/swift-chat/releases) 上发布了新版本，
  请更新您的本地代码，在 Xcode 中重新构建并安装您的应用程序。

**提示**：下载新版本后，请查看版本发布说明，确认是否需要同步更新 API 版本。

### 升级 API

- **对于 AppRunner**：点击并打开 [App Runner Services](https://console.aws.amazon.com/apprunner/home#/services) 页面，
  找到并打开 `swiftchat-api`，点击右上角的 **部署** 按钮。
- **对于 Lambda**：点击并打开 [Lambda Services](https://console.aws.amazon.com/lambda/home#/functions) 页面，找到并打开
  以 `SwiftChatLambda-xxx` 开头的 Lambda 函数，点击 **部署新镜像** 按钮并点击保存。

## 安全

更多信息请参见 [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications)。

## 许可证

该库使用 MIT-0 许可证。详见 [LICENSE](/LICENSE) 文件。
