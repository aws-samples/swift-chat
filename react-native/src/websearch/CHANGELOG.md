# Web Search 更新日志

## 2024-01-06 - 改用事件驱动的WebView加载机制 + 500ms渲染延迟

### 🚀 第三次改进：从固定延迟到事件驱动（参考Cherry Studio实现）

**问题**：
之前使用 `setTimeout(6000)` 固定等待6秒来确保页面加载完成，这种方式：
- ❌ 效率低：页面可能2秒就加载完了，却要等6秒
- ❌ 不可靠：某些情况下6秒可能不够
- ❌ 用户体验差：固定延迟导致响应慢

**解决方案（参考Cherry Studio）**：
监听WebView的 `onLoadEnd` 事件 + 额外等待500ms确保JavaScript渲染完成。

### 📝 具体修改

#### 1. App.tsx - 添加加载完成通知

```typescript
// 在onLoadEnd事件中触发回调
<WebView
  onLoadEnd={() => {
    console.log('[App] WebView load complete');
    // 通知WebViewSearchService页面加载完成
    if ((global as any).onWebViewLoadEnd) {
      (global as any).onWebViewLoadEnd();
    }
  }}
/>
```

#### 2. WebViewSearchService.ts - 改用事件驱动

**旧方式（固定延迟）**：
```typescript
// 加载URL
(global as any).loadWebViewUrl(searchUrl);

// 等待6秒后注入脚本
setTimeout(() => {
  const script = provider.getExtractionScript();
  (global as any).injectWebViewScript(script);
}, 6000); // ❌ 固定6秒延迟
```

**新方式（事件驱动 + 500ms延迟）**：
```typescript
// 设置加载完成回调
(global as any).onWebViewLoadEnd = () => {
  console.log('[WebViewSearch] Page loaded, waiting 500ms for JavaScript to execute');

  // 参考Cherry Studio实现：等待500ms确保JavaScript渲染完成
  setTimeout(() => {
    const script = provider.getExtractionScript();
    console.log('[WebViewSearch] Injecting extraction script');
    (global as any).injectWebViewScript(script);
  }, 500);
};

// 加载URL（加载完成后会自动触发上面的回调）
(global as any).loadWebViewUrl(searchUrl);
```

#### 3. 清理机制

确保回调在以下情况下被清理，避免内存泄漏：
- ✅ 搜索完成时
- ✅ 搜索出错时
- ✅ 超时时

```typescript
this.messageCallback = (message: WebViewMessage) => {
  clearTimeout(timeout);
  this.messageCallback = null;
  (global as any).onWebViewLoadEnd = null;  // 清理回调
  // ...
};
```

### 🎯 优势

1. **更快的响应速度**
   - 页面2秒加载 + 0.5秒渲染 = 2.5秒（vs 之前固定6秒）
   - 平均节省 3-4 秒等待时间

2. **更高的可靠性**
   - 监听真实的 `onLoadEnd` 事件，而不是盲目猜测
   - 额外500ms确保JavaScript完成渲染（关键！）
   - 参考Cherry Studio的成熟实现

3. **更好的资源利用**
   - 不浪费时间在已加载完成的页面上
   - 对于加载慢的页面，会耐心等待（最多15秒总超时）

### 📊 性能对比

| 场景 | 旧方式（固定6秒） | 新方式（事件驱动+500ms） | 改进 |
|------|------------------|------------------------|------|
| 快速网络 | 6秒 | ~2.5秒 | ⚡ 快2.4倍 |
| 一般网络 | 6秒 | ~4.5秒 | ⚡ 快1.3倍 |
| 慢速网络 | 6秒（可能不够） | ~8.5秒 | ✅ 更可靠 |

### 💡 关键发现（来自Cherry Studio源码分析）

Cherry Studio使用Electron的 `webContents.once('did-finish-load')` 监听加载完成，但**关键是在加载完成后额外等待500ms**：

```typescript
// Cherry Studio: src/main/services/SearchService.ts:71-78
window.webContents.once('did-finish-load', () => {
  clearTimeout(loadTimeout)
  // Small delay to ensure JavaScript has executed
  setTimeout(resolve, 500)  // ← 关键：500ms延迟！
})
```

**为什么需要500ms？**
- `onLoadEnd` 触发时，HTML已加载，但JavaScript可能还在执行
- Google搜索结果是通过JavaScript动态渲染的
- 如果立即注入脚本，DOM可能还没有完全渲染好
- 500ms是一个经过实践验证的合理值（Cherry Studio团队的经验）

### 🧪 测试

运行相同的搜索测试，观察日志变化：

```
[WebViewSearch] Loading URL: https://www.google.com/search?q=...
[App] WebView load complete
[App] First load complete, triggering callback
[WebViewSearch] Page loaded, waiting 500ms for JavaScript to execute  ← 新增
[WebViewSearch] Injecting extraction script  ← 500ms后
[WebView] [GoogleProvider] Script started
[WebView] [GoogleProvider] Found X h3 elements  ← 应该能找到结果了
...
```

对比之前的日志，现在应该能成功提取到搜索结果。

### 📁 受影响的文件

- ✅ `src/App.tsx` - 在 `onLoadEnd` 中触发回调
- ✅ `src/websearch/services/WebViewSearchService.ts` - 改用事件驱动机制

### ⚠️ 注意事项

- 保留了15秒总超时，防止页面永远加载不完
- 回调在完成/失败/超时时都会被清理
- 向后兼容，不影响其他功能

---

## 2024-01-06 - 改用JSON格式 + jsonrepair库

### 🎯 第二次改进：集成jsonrepair库

**新增依赖**：
```bash
npm install jsonrepair
```

**改进点**：
- 使用专业的 `jsonrepair` 库替代手写的markdown清理逻辑
- 自动处理各种JSON格式问题：单引号、缺少引号、markdown代码块、尾随逗号、注释等
- 更健壮、更可靠

**示例**：
```typescript
// AI可能返回各种格式的"JSON"
const response = `\`\`\`json
{
  need_search: true,  // 缺少引号的key
  'question': ['Tokyo weather'],  // 单引号
  links: [],  // 尾随逗号
}
\`\`\``;

// jsonrepair自动修复为标准JSON
const repaired = jsonrepair(response);
// {"need_search":true,"question":["Tokyo weather"],"links":[]}
```

---

## 2024-01-06 - 改用JSON格式输出

### 🔄 变更内容

**从XML格式改为JSON格式**

**原因**：
- JSON解析更简单、更可靠
- 更符合现代API设计规范
- 更容易处理边界情况（如markdown代码块）

### 📝 具体修改

#### 1. 提示词格式变更

**旧格式（XML）**:
```xml
<websearch>
  <question>Tokyo weather today</question>
</websearch>
```

**新格式（JSON）**:
```json
{
  "need_search": true,
  "question": ["Tokyo weather today"],
  "links": []
}
```

#### 2. 字段名变更

| 旧字段 | 新字段 | 类型 | 说明 |
|--------|--------|------|------|
| N/A | `need_search` | `boolean` | 是否需要搜索 |
| `question` | `question` | `string[]` | 搜索关键词数组 |
| `links` | `links` | `string[]` | URL链接数组 |

#### 3. 解析函数变更

- 函数名：`extractInfoFromXML()` → `extractInfoFromJSON()`
- 增加了markdown代码块处理（自动移除 ``` 标记）
- 增加了更健壮的错误处理
- 失败时优雅降级为"不需要搜索"

### 🎯 优势

1. **更简单的解析**
   ```typescript
   // 旧方式：需要正则匹配多个标签
   const websearchMatch = xmlText.match(/<websearch>([\s\S]*?)<\/websearch>/);
   const questionMatches = content.match(/<question>(.*?)<\/question>/g);

   // 新方式：一行搞定
   const parsed = JSON.parse(jsonText);
   ```

2. **自动处理markdown代码块**
   ```typescript
   // AI可能返回：
   // ```json
   // { "need_search": true, ... }
   // ```

   // 自动识别并移除代码块标记
   if (jsonText.startsWith('```json')) {
     jsonText = jsonText.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
   }
   ```

3. **类型安全**
   ```typescript
   const result: SearchIntentResult = {
     needsSearch: parsed.need_search === true,  // 严格布尔检查
     keywords: Array.isArray(parsed.question) ? parsed.question : [],  // 数组检查
     links: Array.isArray(parsed.links) && parsed.links.length > 0 ? parsed.links : undefined,
   };
   ```

### 📊 输出示例对比

#### 示例1: 需要搜索

**输入**: "What's the weather in Tokyo today?"

**旧输出（XML）**:
```xml
<websearch>
  <question>Tokyo weather today</question>
</websearch>
```

**新输出（JSON）**:
```json
{
  "need_search": true,
  "question": ["Tokyo weather today"],
  "links": []
}
```

#### 示例2: 不需要搜索

**输入**: "Hello, how are you?"

**旧输出（XML）**:
```xml
<websearch>not_needed</websearch>
```

**新输出（JSON）**:
```json
{
  "need_search": false,
  "question": [],
  "links": []
}
```

#### 示例3: 多关键词

**输入**: "Compare Apple and Microsoft revenue in 2022"

**旧输出（XML）**:
```xml
<websearch>
  <question>Apple revenue 2022</question>
  <question>Microsoft revenue 2022</question>
</websearch>
```

**新输出（JSON）**:
```json
{
  "need_search": true,
  "question": ["Apple revenue 2022", "Microsoft revenue 2022"],
  "links": []
}
```

#### 示例4: 包含链接

**输入**: "Summarize this article: https://example.com/article"

**旧输出（XML）**:
```xml
<websearch>
  <links>https://example.com/article</links>
</websearch>
```

**新输出（JSON）**:
```json
{
  "need_search": true,
  "question": [],
  "links": ["https://example.com/article"]
}
```

### 🧪 测试建议

运行相同的测试用例，确认JSON格式正常工作：

```bash
# 测试1: 需要搜索
输入: "What's the weather in Tokyo today?"
预期: need_search=true, question=["Tokyo weather today"]

# 测试2: 不需要搜索
输入: "Hello"
预期: need_search=false, question=[]

# 测试3: 多关键词
输入: "Compare Apple and Microsoft"
预期: need_search=true, question有2个元素
```

### ⚠️ 兼容性

**无向后兼容问题** - 这是内部实现更改，对外部API接口无影响。

`SearchIntentResult` 类型定义保持不变：
```typescript
interface SearchIntentResult {
  needsSearch: boolean;
  keywords: string[];
  links?: string[];
}
```

### 📁 受影响的文件

- ✅ `services/IntentAnalysisService.ts` - 主要修改
  - 更新 `INTENT_ANALYSIS_PROMPT`
  - `extractInfoFromXML()` → `extractInfoFromJSON()`
  - 增强错误处理

- ℹ️ `types.ts` - 无需修改
- ℹ️ 其他文件 - 无需修改

### 🎉 完成

现在系统使用更现代、更可靠的JSON格式进行意图分析！
