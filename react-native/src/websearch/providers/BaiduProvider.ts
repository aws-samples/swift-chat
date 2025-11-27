/**
 * Baidu Search Provider
 * 百度搜索引擎的DOM选择器和URL生成
 */

import { SearchResultItem } from '../types';

interface RawSearchResult {
  title: string;
  url: string;
}

interface ParsedSearchData {
  type: string;
  results?: RawSearchResult[];
}

export class BaiduProvider {
  /**
   * 搜索引擎名称
   */
  readonly name = 'Baidu';

  /**
   * 生成搜索URL
   */
  getSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
    return `https://www.baidu.com/s?wd=${encodedQuery}`;
  }

  /**
   * 生成注入的JavaScript代码，用于提取搜索结果
   */
  getExtractionScript(): string {
    return `
      (function() {
        try {
          const results = [];

          // 策略: 尝试多个选择器来适配不同版本的百度搜索页面
          const selectors = [
            // 最新版本的百度搜索结果
            '#content_left .result h3 a',
            '#content_left .c-container h3 a',
            // 新版百度
            '.result h3 a',
            '.c-container h3.c-title a',
            '.c-container h3.t a',
            // 移动端适配
            '.result-op h3 a',
            // 通用回退方案
            'h3 a[href]',
          ];

          let foundResults = false;

          for (const selector of selectors) {
            if (foundResults) break;

            const items = document.querySelectorAll(selector);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'console_log',
              log: 'Trying selector: ' + selector + ', found ' + items.length + ' items'
            }));

            if (items.length > 0) {
              items.forEach((linkElement) => {
                try {
                  if (linkElement && linkElement.href) {
                    const title = linkElement.textContent || linkElement.innerText || '';
                    let url = linkElement.href;

                    // 基本过滤：排除明显的内部链接
                    const isValidUrl =
                      title.trim() &&
                      url &&
                      !url.includes('baidu.com/s?') &&
                      !url.includes('baidu.com/sf/') &&
                      !url.startsWith('javascript:') &&
                      !url.startsWith('#') &&
                      !url.includes('passport.baidu.com');

                    if (isValidUrl) {
                      // 避免重复
                      const isDuplicate = results.some(r => r.url === url || r.title === title.trim());
                      if (!isDuplicate) {
                        results.push({
                          title: title.trim(),
                          url: url
                        });
                        foundResults = true;
                      }
                    }
                  }
                } catch (error) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'console_log',
                    log: 'Error processing item: ' + error.message
                  }));
                }
              });
            }
          }

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'console_log',
            log: 'Baidu extraction complete, found ' + results.length + ' results'
          }));

          // 发送结果回React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'search_results',
            results: results
          }));
        } catch (error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'search_error',
            error: error.message
          }));
        }

        true; // 必须返回true
      })();
    `;
  }

  /**
   * 解析从WebView返回的结果
   */
  parseResults(data: ParsedSearchData): SearchResultItem[] {
    if (data.type === 'search_results' && Array.isArray(data.results)) {
      return data.results.map((item: RawSearchResult) => ({
        title: item.title,
        url: item.url,
      }));
    }
    return [];
  }
}

export const baiduProvider = new BaiduProvider();
