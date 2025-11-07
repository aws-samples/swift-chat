# Web Search 功能实现文档

## 📋 已完成的阶段

### ✅ 阶段1: 意图分析与关键词提取
- **文件**: `services/IntentAnalysisService.ts`
- **功能**: 调用AI模型分析用户输入，判断是否需要搜索，并提取搜索关键词
- **使用的Prompt**: 参考Cherry Studio的SEARCH_SUMMARY_PROMPT
- **输出格式**: JSON格式（使用jsonrepair库处理），例如：
  ```json
  {
    "need_search": true,
    "question": ["Tokyo weather today"],
    "links": []
  }
  ```

### ✅ 阶段2: WebView搜索
- **文件**:
  - `services/WebViewSearchService.ts` - 搜索服务
  - `providers/GoogleProvider.ts` - Google搜索提供者
- **功能**:
  - 使用隐藏的WebView加载Google搜索页面
  - 事件驱动的页面加载检测（onLoadEnd）
  - 注入JavaScript提取搜索结果（标题+URL）
  - 返回前N条结果
- **性能优化**:
  - 使用事件驱动替代固定延迟，平均快2-4秒
  - 多个DOM选择器fallback，提高成功率
  - Desktop User-Agent，避免移动版重定向

### ✅ App.tsx集成
- 添加了全局隐藏的WebView
- 通过global回调与WebViewSearchService通信
- 完全不可见，不影响用户体验

### ✅ ChatScreen.tsx集成
- 在`onSend`方法中添加了测试代码
- 自动检测用户输入并触发搜索流程
- 打印详细的日志方便调试

---

## 🧪 测试方法

### 1. 启动应用
```bash
# 确保依赖已安装
npm install

# iOS
npm run ios

# Android
npm run android
```

### 2. 测试用例

#### 测试1: 需要搜索的问题
输入: `"What's the weather in Tokyo today?"`

**预期输出**:
```
🔍 ========== WEB SEARCH TEST START ==========
📝 Phase 1: Analyzing search intent...
[IntentAnalysis] Starting intent analysis
[IntentAnalysis] User message: What's the weather in Tokyo today?
...
[IntentAnalysis] Needs search: true
[IntentAnalysis] Keywords: ["Tokyo weather today"]
✅ Search needed! Keywords: ["Tokyo weather today"]

🌐 Phase 2: Searching for "Tokyo weather today"...
[WebViewSearch] Starting search
[WebViewSearch] Loading URL: https://www.google.com/search?q=Tokyo%20weather%20today
[App] Loading URL in hidden WebView: https://www.google.com/search?q=Tokyo%20weather%20today
[App] WebView load complete
[WebViewSearch] Page loaded, injecting extraction script
[WebView] Found 10 result containers
[WebView] Result 1: Weather - Tokyo
...
[WebViewSearch] Total results: 10

✅ ========== WEB SEARCH RESULTS ==========
Total results: 5

[1] Weather - Tokyo
    URL: https://www.weather.com/...

[2] Tokyo Weather Forecast
    URL: https://www.jma.go.jp/...

...
========== WEB SEARCH TEST END ==========
```

#### 测试2: 不需要搜索的问题
输入: `"Hello, how are you?"`

**预期输出**:
```
🔍 ========== WEB SEARCH TEST START ==========
📝 Phase 1: Analyzing search intent...
[IntentAnalysis] Result: not_needed
ℹ️  No search needed for this query
========== WEB SEARCH TEST END ==========
```

#### 测试3: 对比性问题（多关键词）
输入: `"Which company had higher revenue in 2022, Apple or Microsoft?"`

**预期输出**:
```
[IntentAnalysis] Keywords: ["Apple revenue 2022", "Microsoft revenue 2022"]
✅ Search needed! Keywords: ["Apple revenue 2022", "Microsoft revenue 2022"]
🌐 Phase 2: Searching for "Apple revenue 2022"...
（注意：当前只搜索第一个关键词）
```

---

## 📁 文件结构

```
src/websearch/
├── types.ts                          # TypeScript类型定义
├── README.md                         # 本文档
├── services/
│   ├── index.ts                      # 服务统一导出
│   ├── IntentAnalysisService.ts      # 阶段1: 意图分析
│   ├── WebViewSearchService.ts       # 阶段2: WebView搜索
│   ├── ContentFetchService.ts        # 阶段4+5: 内容获取与解析
│   ├── PromptBuilderService.ts       # 阶段6: Prompt构建
│   └── WebSearchOrchestrator.ts      # 完整流程编排器
├── providers/
│   └── GoogleProvider.ts             # Google搜索引擎实现
└── components/
    └── SearchWebView.tsx             # WebView UI组件
```

---

## 🔧 技术实现细节

### 1. 流式API转同步
```typescript
// IntentAnalysisService.ts
private async invokeModelSync(messages: BedrockMessage[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let fullResponse = '';
    invokeBedrockWithCallBack(
      messages,
      ChatMode.Text,
      null,
      () => false,
      controller,
      (text: string, complete: boolean) => {
        fullResponse = text;
        if (complete) resolve(fullResponse);
      }
    ).catch(reject);
  });
}
```

### 2. WebView通信机制
```
ChatScreen (onSend)
    ↓ 调用
webViewSearchService.search()
    ↓ 通过global
App.tsx (loadWebViewUrl)
    ↓ setState触发
WebView组件加载
    ↓ onLoadEnd后
App.tsx (injectWebViewScript)
    ↓ 注入JS
WebView执行脚本提取结果
    ↓ postMessage
webViewSearchService.handleMessage()
    ↓ 解析
返回SearchResultItem[]
```

### 3. Google DOM选择器
```javascript
// 搜索结果容器
document.querySelectorAll('#search .MjjYud')

// 每个结果的标题
item.querySelector('h3')

// 每个结果的链接
item.querySelector('a')
```

---

## ⚠️ 已知限制

1. **搜索引擎限制**
   - 目前仅实现了Google
   - Bing和Baidu待实现

2. **多关键词处理**
   - 当前只搜索第一个关键词
   - 后续可以并发搜索多个关键词

3. **WebView性能**
   - 页面加载需要3-4秒
   - 目前通过固定延迟注入脚本（可优化为监听onLoadEnd）

4. **错误处理**
   - 已添加15秒超时
   - 需要测试各种失败场景（网络错误、选择器失效等）

---

### ✅ 阶段3: 解析前N条URL
- 通过GoogleProvider的parseResults实现
- 限制结果数量（默认5条）

### ✅ 阶段4: 并发fetch URL内容
- **文件**: `services/ContentFetchService.ts`
- **功能**:
  - 使用`Promise.allSettled`并发获取多个URL
  - 每个请求独立超时控制（默认30秒）
  - 容错处理：单个失败不影响其他请求
- **技术栈**:
  - `fetch` API进行HTTP请求
  - `AbortController` 实现超时控制

### ✅ 阶段5: Readability + Turndown
- **集成在**: `ContentFetchService.ts`
- **功能**:
  - 使用`linkedom`解析HTML（React Native兼容的轻量级DOM）
  - 使用`@mozilla/readability`提取网页主要内容
  - 使用`turndown`将HTML转换为Markdown
  - 自动截断过长内容（默认5000字符）
- **依赖包**:
  ```bash
  npm install @mozilla/readability turndown linkedom --save
  ```

### ✅ 阶段6: 构建最终Prompt
- **文件**: `services/PromptBuilderService.ts`
- **功能**:
  - 参考Cherry Studio的REFERENCE_PROMPT格式
  - 为每个引用添加编号[1], [2]等
  - 构建包含引用规则的完整Prompt
- **输出格式**:
  ```
  Please answer the question based on the reference materials

  ## Citation Rules:
  - Use [number] to cite sources
  - Cite at the end of sentences
  ...

  ## My question is:
  用户问题

  ## Reference Materials:
  [1] Title: ...
  URL: ...
  Content: ...
  ```

### ✅ 编排器: WebSearchOrchestrator
- **文件**: `services/WebSearchOrchestrator.ts`
- **功能**: 统一协调所有阶段，提供一站式API
- **用法**:
  ```typescript
  import { webSearchOrchestrator } from './websearch/services';

  const result = await webSearchOrchestrator.search(
    userMessage,
    conversationHistory,
    (stage, message) => {
      console.log(`[${stage}] ${message}`);
    }
  );

  if (result && result.enhancedPrompt) {
    // 使用增强后的Prompt调用AI模型
    const response = await invokeBedrockWithCallBack(
      [{ role: 'user', content: result.enhancedPrompt }],
      ...
    );
  }
  ```

## 🚀 接下来的工作

### 集成到ChatScreen
- 📝 修改ChatScreen.tsx，将测试代码改为实际使用
- 📝 在发送消息前调用webSearchOrchestrator
- 📝 使用返回的enhancedPrompt替换原始userMessage
- 📝 添加搜索进度UI显示

### 性能优化
- 📝 调整超时时间和并发数
- 📝 添加缓存机制避免重复搜索
- 📝 优化Markdown输出格式

---

## 🐛 调试建议

### 查看完整日志
```bash
# iOS
npx react-native log-ios

# Android
npx react-native log-android
```

### 关键日志标签
- `[IntentAnalysis]` - 意图分析相关
- `[WebViewSearch]` - WebView搜索相关
- `[GoogleProvider]` - Google提供者相关
- `[App]` - App.tsx的WebView相关
- `[WebView]` - WebView内部JavaScript日志

### 常见问题

1. **"WebView not initialized"错误**
   - 原因：App.tsx还未加载完成
   - 解决：等待App完全启动后再发送消息

2. **搜索超时**
   - 原因：网络慢或Google页面结构变化
   - 解决：检查网络连接，查看WebView日志

3. **无搜索结果**
   - 原因：DOM选择器失效
   - 解决：查看`[GoogleProvider]`日志中的"Found X result containers"

---

## 📚 参考资料

- Cherry Studio源码: `cherry-studio-main/src/renderer/src/`
- React Native WebView: https://github.com/react-native-webview/react-native-webview
- Mozilla Readability: https://github.com/mozilla/readability
- Turndown: https://github.com/mixmark-io/turndown
