/**
 * Baidu Search Provider
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
  readonly name = 'Baidu';

  getSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
    return `https://www.baidu.com/s?wd=${encodedQuery}`;
  }

  getExtractionScript(): string {
    return `
      (function() {
        try {
          const results = [];

          const selectors = [
            '#content_left .result h3 a',
            '#content_left .c-container h3 a',
            '.result h3 a',
            '.c-container h3.c-title a',
            '.c-container h3.t a',
            '.result-op h3 a',
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

                    const isValidUrl =
                      title.trim() &&
                      url &&
                      !url.includes('baidu.com/s?') &&
                      !url.includes('baidu.com/sf/') &&
                      !url.startsWith('javascript:') &&
                      !url.startsWith('#') &&
                      !url.includes('passport.baidu.com');

                    if (isValidUrl) {
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

        true;
      })();
    `;
  }

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
