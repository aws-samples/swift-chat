/**
 * Bing Search Provider
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

export class BingProvider {
  readonly name = 'Bing';

  getSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
   return `https://www.bing.com/search?q=${encodedQuery}`;
  }

  getExtractionScript(expectedQuery?: string): string {
    return `
      (function() {
        try {
          ${
            expectedQuery
              ? `if (!window.location.href.includes('q=${encodeURIComponent(
                  expectedQuery
                )}')) return;`
              : ''
          }
          const results = [];

          const items = document.querySelectorAll('#b_results h2');

          items.forEach((item) => {
            try {
              const linkElement = item.querySelector('a');

              if (linkElement && linkElement.href) {
                const title = linkElement.textContent || linkElement.innerText || '';
                let url = linkElement.href;
                if (url.includes('bing.com/ck/a')) {
                  try {
                    const urlObj = new URL(url);
                    const encodedUrl = urlObj.searchParams.get('u');

                    if (encodedUrl) {
                      const base64Part = encodedUrl.substring(2);
                      const decodedUrl = atob(base64Part);
                      if (decodedUrl.startsWith('http')) {
                        url = decodedUrl;
                      }
                    }
                  } catch (decodeError) {
                  }
                }

                const isValidUrl =
                  title.trim() &&
                  url &&
                  !url.includes('bing.com/search?') &&
                  !url.includes('bing.com/settings') &&
                  !url.includes('login.live.com') &&
                  !url.startsWith('javascript:') &&
                  !url.startsWith('#');

                if (isValidUrl) {
                  const isDuplicate = results.some(r => r.url === url || r.title === title.trim());
                  if (!isDuplicate) {
                    results.push({
                      title: title.trim(),
                      url: url
                    });
                  }
                }
              }
            } catch (error) {
            }
          });

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

export const bingProvider = new BingProvider();
