/**
 * WebView Search Service
 * 阶段2: 使用WebView获取搜索引擎结果
 */

import { SearchResultItem, SearchEngine } from '../types';
import { googleProvider } from '../providers/GoogleProvider';

// 事件发送函数类型
type SendEventFunc = (event: string, params?: { url?: string; script?: string; data?: string }) => void;

/**
 * WebView消息类型
 */
interface WebViewMessage {
  type: string;
  results?: SearchResultItem[];
  error?: string;
  log?: string;
  message?: string;
}

/**
 * WebView搜索服务
 * 注意：此服务需要配合App.tsx中的事件系统使用
 */
export class WebViewSearchService {
  private messageCallback: ((message: WebViewMessage) => void) | null = null;
  private currentEngine: SearchEngine = 'google';
  private currentTimeoutId: NodeJS.Timeout | null = null;
  private sendEvent: SendEventFunc | null = null;
  private eventListeners: Map<string, (params?: { data?: string }) => void> = new Map();

  /**
   * 设置事件发送函数（由外部调用，通常在初始化时）
   */
  setSendEvent(sendEvent: SendEventFunc) {
    this.sendEvent = sendEvent;
  }

  /**
   * 监听来自App的事件
   */
  addEventListener(eventName: string, callback: (params?: { data?: string }) => void) {
    this.eventListeners.set(eventName, callback);
  }

  /**
   * 处理来自App的事件（由外部调用）
   */
  handleEvent(eventName: string, params?: { data?: string }) {
    const callback = this.eventListeners.get(eventName);
    if (callback) {
      callback(params);
    }
  }

  /**
   * 设置消息回调
   * 由App.tsx中的WebView调用
   */
  setMessageCallback(callback: (message: WebViewMessage) => void) {
    this.messageCallback = callback;
  }

  /**
   * 处理从WebView接收的消息
   * 由App.tsx中的WebView的onMessage调用
   */
  handleMessage(data: string) {
    try {
      const message = JSON.parse(data) as WebViewMessage;

      // 打印WebView日志（包括调试信息）
      if (message.type === 'console_log' && message.log) {
        console.log('[WebView]', message.log);
        // 注意：console_log类型的消息不转发给callback，只用于调试
        return;
      }

      // 处理验证码请求
      if (message.type === 'captcha_required') {
        console.log('[WebViewSearch] CAPTCHA detected, showing WebView to user');
        // 显示WebView让用户完成验证
        if (this.sendEvent) {
          this.sendEvent('webview:showCaptcha');
        }

        // 设置一个监听器，当用户完成验证后（页面重新加载），自动重新提取
        // 注意：不依赖这个事件来关闭验证码窗口，而是在获取到搜索结果时自动关闭
        this.addEventListener('webview:loadEndTriggered', () => {
          console.log('[WebViewSearch] Page reloaded after CAPTCHA, waiting 500ms then retrying extraction');
          setTimeout(() => {
            const provider = this.getProvider(this.currentEngine);
            const script = provider.getExtractionScript();
            console.log('[WebViewSearch] Re-injecting extraction script after CAPTCHA');
            if (this.sendEvent) {
              this.sendEvent('webview:injectScript', { script });
            }
          }, 500); // 等待500ms确保验证通过后的页面加载完成（搜索结果需要JS渲染）
        });

        return;
      }

      // 转发给当前等待的回调（search_results 或 search_error）
      if (this.messageCallback) {
        this.messageCallback(message);
      }
    } catch (error) {
      console.error('[WebViewSearch] Failed to parse message:', error);
      console.error('[WebViewSearch] Raw data:', data);
    }
  }

  /**
   * 执行搜索
   * @param query 搜索关键词
   * @param engine 搜索引擎
   * @param maxResults 最大结果数
   * @returns 搜索结果
   */
  async search(
    query: string,
    engine: SearchEngine = 'google',
    maxResults: number = 5
  ): Promise<SearchResultItem[]> {
    console.log('\n========================================');
    console.log('[WebViewSearch] Starting search');
    console.log('[WebViewSearch] Query:', query);
    console.log('[WebViewSearch] Engine:', engine);
    console.log('[WebViewSearch] Max results:', maxResults);
    console.log('========================================\n');

    this.currentEngine = engine;

    return new Promise((resolve, reject) => {
      // 初始超时时间120秒（给用户足够时间完成验证）
      this.currentTimeoutId = setTimeout(() => {
        this.messageCallback = null;
        this.currentTimeoutId = null;
        this.eventListeners.clear();
        if (this.sendEvent) {
          this.sendEvent('webview:hide');
        }
        reject(new Error('Search timeout after 120 seconds'));
      }, 120000);

      // 设置用户关闭验证码窗口的回调
      this.addEventListener('webview:captchaClosed', () => {
        console.log('[WebViewSearch] User closed CAPTCHA window, cancelling search');

        // 清理超时计时器
        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          this.currentTimeoutId = null;
        }

        // 清理回调和监听器
        this.messageCallback = null;
        this.eventListeners.clear();

        // 隐藏 WebView
        if (this.sendEvent) {
          this.sendEvent('webview:hide');
        }

        // 拒绝 Promise，让上层处理
        reject(new Error('User cancelled CAPTCHA verification'));
      });


      // 设置消息回调
      this.messageCallback = (message: WebViewMessage) => {
        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          this.currentTimeoutId = null;
        }
        this.messageCallback = null;
        this.eventListeners.clear();

        if (message.type === 'search_error') {
          console.error('[WebViewSearch] Search error:', message.error);
          if (this.sendEvent) {
            this.sendEvent('webview:hide');
          }
          reject(new Error(message.error || 'Unknown error'));
          return;
        }

        if (message.type === 'search_results') {
          const provider = this.getProvider(engine);
          const results = provider.parseResults(message);

          // 核心逻辑：获取到搜索结果后，自动关闭验证码窗口
          // 无论验证通过事件是否能被捕捉到，只要拿到结果就关闭
          console.log('[WebViewSearch] Got search results, hiding CAPTCHA window if visible');
          if (this.sendEvent) {
            this.sendEvent('webview:hide');
          }

          console.log('\n========================================');
          console.log('[WebViewSearch] Search complete');
          console.log('[WebViewSearch] Total results:', results.length);
          console.log('[WebViewSearch] Results:');
          results.slice(0, maxResults).forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.title}`);
            console.log(`     ${item.url}`);
          });
          console.log('========================================\n');

          resolve(results.slice(0, maxResults));
        }
      };

      // 性能计时：记录开始时间
      const perfStart = performance.now();

      // 获取provider
      const provider = this.getProvider(engine);

      // 生成搜索URL
      const searchUrl = provider.getSearchUrl(query);
      console.log('[WebViewSearch] Loading URL:', searchUrl);

      // 设置加载完成回调，在页面加载完成后注入脚本
      this.addEventListener('webview:loadEndTriggered', () => {
        const pageLoadTime = performance.now();
        console.log(`[WebViewSearch] ⏱️  Page loaded (${(pageLoadTime - perfStart).toFixed(0)}ms), using progressive injection`);

        // 渐进式尝试注入：100ms → 200ms → 400ms → 800ms，最后兜底 1500ms
        const delays = [100, 200, 400, 800];
        let attemptCount = 0;
        let injected = false;

        const tryInject = () => {
          if (injected) return;

          attemptCount++;
          const currentDelay = delays.shift() || 1500;

          setTimeout(() => {
            if (injected) return;

            const beforeInjectTime = performance.now();
            console.log(`[WebViewSearch] ⏱️  Attempt ${attemptCount} (${(beforeInjectTime - pageLoadTime).toFixed(0)}ms), injecting extraction script`);

            const script = provider.getExtractionScript();

            if (this.sendEvent) {
              injected = true; // 标记已注入
              this.sendEvent('webview:injectScript', { script });
            } else {
              if (this.currentTimeoutId) {
                clearTimeout(this.currentTimeoutId);
                this.currentTimeoutId = null;
              }
              this.messageCallback = null;
              reject(new Error('WebView script injection not available'));
            }

            // 如果还有下一个延迟，继续尝试（作为备份）
            if (delays.length > 0 && !injected) {
              tryInject();
            }
          }, currentDelay);
        };

        // 开始首次尝试
        tryInject();
      });

      // 加载搜索页面
      if (this.sendEvent) {
        this.sendEvent('webview:loadUrl', { url: searchUrl });
      } else {
        this.eventListeners.clear();
        reject(new Error('WebView not initialized. Make sure App.tsx has loaded.'));
      }
    });
  }

  /**
   * 获取搜索引擎provider
   */
  private getProvider(engine: SearchEngine) {
    switch (engine) {
      case 'google':
        return googleProvider;
      case 'bing':
        // TODO: 实现BingProvider
        throw new Error('Bing provider not implemented yet');
      case 'baidu':
        // TODO: 实现BaiduProvider
        throw new Error('Baidu provider not implemented yet');
      default:
        return googleProvider;
    }
  }
}

/**
 * 全局单例
 */
export const webViewSearchService = new WebViewSearchService();
