/**
 * WebView Search Service
 * Phase 2: Use WebView to get search engine results
 */

import { SearchResultItem, SearchEngine } from '../types';
import { googleProvider } from '../providers/GoogleProvider';
import { baiduProvider } from '../providers/BaiduProvider';
import { bingProvider } from '../providers/BingProvider';

type SendEventFunc = (event: string, params?: { url?: string; script?: string; data?: string; error?: string; code?: number }) => void;

interface WebViewMessage {
  type: string;
  results?: SearchResultItem[];
  error?: string;
  log?: string;
  message?: string;
}

export class WebViewSearchService {
  private messageCallback: ((message: WebViewMessage) => void) | null = null;
  private currentEngine: SearchEngine = 'google';
  private currentTimeoutId: NodeJS.Timeout | null = null;
  private currentReject: ((error: Error) => void) | null = null;
  private sendEvent: SendEventFunc | null = null;
  private eventListeners: Map<string, (params?: { data?: string; error?: string; code?: number }) => void> = new Map();

  setSendEvent(sendEvent: SendEventFunc) {
    this.sendEvent = sendEvent;
  }

  addEventListener(eventName: string, callback: (params?: { data?: string; error?: string; code?: number }) => void) {
    this.eventListeners.set(eventName, callback);
  }

  handleEvent(eventName: string, params?: { data?: string; error?: string; code?: number }) {
    const callback = this.eventListeners.get(eventName);
    if (callback) {
      callback(params);
    }
  }

  setMessageCallback(callback: (message: WebViewMessage) => void) {
    this.messageCallback = callback;
  }

  handleMessage(data: string) {
    try {
      const message = JSON.parse(data) as WebViewMessage;

      if (message.type === 'console_log' && message.log) {
        console.log('[WebView]', message.log);
        return;
      }

      if (message.type === 'captcha_required') {
        console.log('[WebViewSearch] CAPTCHA detected, showing WebView to user');

        // Extend timeout to 120 seconds for CAPTCHA verification
        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          console.log('[WebViewSearch] Extending timeout to 120 seconds for CAPTCHA');
          this.currentTimeoutId = setTimeout(() => {
            this.messageCallback = null;
            this.currentTimeoutId = null;
            this.eventListeners.clear();
            if (this.sendEvent) {
              this.sendEvent('webview:hide');
            }
            if (this.currentReject) {
              this.currentReject(new Error('CAPTCHA verification timeout after 120 seconds'));
              this.currentReject = null;
            }
          }, 120000);
        }

        if (this.sendEvent) {
          this.sendEvent('webview:showCaptcha');
        }

        this.addEventListener('webview:loadEndTriggered', () => {
          console.log('[WebViewSearch] Page reloaded after CAPTCHA, waiting 500ms then retrying extraction');
          setTimeout(() => {
            const provider = this.getProvider(this.currentEngine);
            const script = provider.getExtractionScript();
            console.log('[WebViewSearch] Re-injecting extraction script after CAPTCHA');
            if (this.sendEvent) {
              this.sendEvent('webview:injectScript', { script });
            }
          }, 500);
        });

        return;
      }

      if (this.messageCallback) {
        this.messageCallback(message);
      }
    } catch (error) {
      console.error('[WebViewSearch] Failed to parse message:', error);
      console.error('[WebViewSearch] Raw data:', data);
    }
  }

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
      // Save reject for CAPTCHA timeout extension
      this.currentReject = reject;

      // Initial timeout: 15 seconds for normal search
      this.currentTimeoutId = setTimeout(() => {
        this.messageCallback = null;
        this.currentTimeoutId = null;
        this.currentReject = null;
        this.eventListeners.clear();
        if (this.sendEvent) {
          this.sendEvent('webview:hide');
        }
        reject(new Error('Search timeout after 15 seconds'));
      }, 15000);

      this.addEventListener('webview:captchaClosed', () => {
        console.log('[WebViewSearch] User closed CAPTCHA window, cancelling search');

        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          this.currentTimeoutId = null;
        }

        this.messageCallback = null;
        this.currentReject = null;
        this.eventListeners.clear();

        if (this.sendEvent) {
          this.sendEvent('webview:hide');
        }

        reject(new Error('User cancelled CAPTCHA verification'));
      });

      this.addEventListener('webview:error', (params) => {
        const errorMsg = params?.error || 'WebView load failed';
        const errorCode = params?.code || 'unknown';
        console.log('[WebViewSearch] WebView error, terminating search:', errorMsg, 'Code:', errorCode);
        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          this.currentTimeoutId = null;
        }

        this.messageCallback = null;
        this.currentReject = null;
        this.eventListeners.clear();

        if (this.sendEvent) {
          this.sendEvent('webview:hide');
        }

        reject(new Error(`WebView error (${errorCode}): ${errorMsg}`));
      });

      this.messageCallback = (message: WebViewMessage) => {
        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          this.currentTimeoutId = null;
        }
        this.messageCallback = null;
        this.currentReject = null;
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

      const perfStart = performance.now();

      const provider = this.getProvider(engine);

      const searchUrl = provider.getSearchUrl(query);
      console.log('[WebViewSearch] Loading URL:', searchUrl);

      this.addEventListener('webview:loadEndTriggered', () => {
        const pageLoadTime = performance.now();
        console.log(`[WebViewSearch] ⏱️  Page loaded (${(pageLoadTime - perfStart).toFixed(0)}ms), using progressive injection`);

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
              injected = true;
              this.sendEvent('webview:injectScript', { script });
            } else {
              if (this.currentTimeoutId) {
                clearTimeout(this.currentTimeoutId);
                this.currentTimeoutId = null;
              }
              this.messageCallback = null;
              this.currentReject = null;
              reject(new Error('WebView script injection not available'));
            }

            if (delays.length > 0 && !injected) {
              tryInject();
            }
          }, currentDelay);
        };

        tryInject();
      });

      if (this.sendEvent) {
        this.sendEvent('webview:loadUrl', { url: searchUrl });
      } else {
        this.currentReject = null;
        this.eventListeners.clear();
        reject(new Error('WebView not initialized. Make sure App.tsx has loaded.'));
      }
    });
  }

  private getProvider(engine: SearchEngine) {
    switch (engine) {
      case 'google':
        return googleProvider;
      case 'bing':
        return bingProvider;
      case 'baidu':
        return baiduProvider;
      default:
        return googleProvider;
    }
  }
}

export const webViewSearchService = new WebViewSearchService();
