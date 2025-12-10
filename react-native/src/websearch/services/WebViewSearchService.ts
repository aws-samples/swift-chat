/**
 * WebView Search Service
 * Phase 2: Use WebView to get search engine results
 */

import { SearchResultItem, SearchEngine } from '../types';
import { googleProvider } from '../providers/GoogleProvider';
import { baiduProvider } from '../providers/BaiduProvider';
import { bingProvider } from '../providers/BingProvider';

type SendEventFunc = (
  event: string,
  params?: {
    url?: string;
    script?: string;
    data?: string;
    error?: string;
    code?: number;
  }
) => void;

interface WebViewMessage {
  type: string;
  results?: SearchResultItem[];
  error?: string;
  log?: string;
  message?: string;
  actualUrl?: string;
}

export class WebViewSearchService {
  private messageCallback: ((message: WebViewMessage) => void) | null = null;
  private currentEngine: SearchEngine = 'google';
  private currentQuery: string = '';
  private currentTimeoutId: NodeJS.Timeout | null = null;
  private currentReject: ((error: Error) => void) | null = null;
  private sendEvent: SendEventFunc | null = null;
  private eventListeners: Map<
    string,
    (params?: { data?: string; error?: string; code?: number }) => void
  > = new Map();

  setSendEvent(sendEvent: SendEventFunc) {
    this.sendEvent = sendEvent;
  }

  addEventListener(
    eventName: string,
    callback: (params?: {
      data?: string;
      error?: string;
      code?: number;
    }) => void
  ) {
    this.eventListeners.set(eventName, callback);
  }

  handleEvent(
    eventName: string,
    params?: { data?: string; error?: string; code?: number }
  ) {
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

      if (message.type === 'console_log') {
        return;
      }

      if (message.type === 'captcha_required') {
        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          this.currentTimeoutId = setTimeout(() => {
            this.messageCallback = null;
            this.currentTimeoutId = null;
            this.eventListeners.clear();
            if (this.sendEvent) {
              this.sendEvent('webview:hide');
            }
            if (this.currentReject) {
              this.currentReject(
                new Error('CAPTCHA verification timeout after 120 seconds')
              );
              this.currentReject = null;
            }
          }, 120000);
        }

        if (this.sendEvent) {
          this.sendEvent('webview:showCaptcha');
        }

        this.addEventListener('webview:loadEndTriggered', () => {
          setTimeout(() => {
            const provider = this.getProvider(this.currentEngine);
            const script = provider.getExtractionScript(this.currentQuery);
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
      console.log('[WebViewSearch] Failed to parse message:', error);
    }
  }

  async search(
    query: string,
    engine: SearchEngine = 'google',
    maxResults: number = 5,
    abortController?: AbortController
  ): Promise<SearchResultItem[]> {
    this.currentEngine = engine;
    this.currentQuery = query;

    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (abortController?.signal.aborted) {
        reject(new Error('Search aborted by user'));
        return;
      }

      const abortListener = () => {
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
        reject(new Error('Search aborted by user'));
      };

      abortController?.signal.addEventListener('abort', abortListener);

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

      this.addEventListener('webview:error', params => {
        const errorMsg = params?.error || 'WebView load failed';
        const errorCode = params?.code || 'unknown';

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
        abortController?.signal.removeEventListener('abort', abortListener);

        if (message.type === 'search_error') {
          if (this.sendEvent) {
            this.sendEvent('webview:hide');
          }
          reject(new Error(message.error || 'Unknown error'));
          return;
        }

        if (message.type === 'search_results') {
          const provider = this.getProvider(engine);
          const results = provider.parseResults(message);

          if (
            engine === 'bing' &&
            message.actualUrl &&
            'setLastUsedBaseUrl' in provider
          ) {
            (
              provider as { setLastUsedBaseUrl: (url: string) => void }
            ).setLastUsedBaseUrl(message.actualUrl);
          }

          if (this.sendEvent) {
            this.sendEvent('webview:hide');
          }

          resolve(results.slice(0, maxResults));
        }
      };

      const provider = this.getProvider(engine);
      const searchUrl = provider.getSearchUrl(query);

      this.addEventListener('webview:loadEndTriggered', () => {
        const delays = [100, 200, 400, 800];
        let injected = false;

        const tryInject = () => {
          if (injected) {
            return;
          }

          const currentDelay = delays.shift() || 1500;

          setTimeout(() => {
            if (injected) {
              return;
            }

            const script = provider.getExtractionScript(query);

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
        reject(
          new Error('WebView not initialized. Make sure App.tsx has loaded.')
        );
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
