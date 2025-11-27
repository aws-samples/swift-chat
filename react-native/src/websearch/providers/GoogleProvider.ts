/**
 * Google Search Provider
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

export class GoogleProvider {
  readonly name = 'Google';

  getSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
    return `https://www.google.com/search?q=${encodedQuery}`;
  }

  getExtractionScript(): string {
    return `
      (function() {
        try {
          const fullHTML = document.documentElement.outerHTML;
          const hasCaptcha = fullHTML.includes('captcha') || fullHTML.includes('recaptcha');
          const hasRobotCheck = fullHTML.toLowerCase().includes('unusual traffic') || fullHTML.toLowerCase().includes('automated');

          const h3Count = document.querySelectorAll('h3').length;
          const hasActualContent = h3Count >= 3;

          if ((hasCaptcha || hasRobotCheck) || !hasActualContent) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'captcha_required',
              message: 'CAPTCHA verification required'
            }));
            return;
          }

          const results = [];

          const selectors = [
            '#search .MjjYud',
            '#search .g',
            '#rso .g',
            '.hlcw0c',
            '[data-sokoban-container]',
            'div[data-hveid] > div > div',
            '#rso > div',
            '.v7W49e',
            '.tF2Cxc',
            '.Gx5Zad'
          ];

          let items = null;

          for (const selector of selectors) {
            items = document.querySelectorAll(selector);
            if (items && items.length > 0) {
              break;
            }
          }

          if (!items || items.length === 0) {
            const h3Elements = document.querySelectorAll('h3');

            h3Elements.forEach((h3) => {
              try {
                let linkElement = h3.closest('a');
                if (!linkElement) {
                  const parent = h3.parentElement;
                  if (parent) {
                    linkElement = parent.querySelector('a');
                  }
                }

                if (linkElement && linkElement.href && h3.textContent) {
                  const url = linkElement.href;
                  const title = h3.textContent.trim();

                  if (title &&
                      !url.includes('google.com/search') &&
                      !url.includes('google.com/url?') &&
                      !url.includes('google.com/settings') &&
                      !url.includes('accounts.google') &&
                      !url.startsWith('javascript:')) {

                    const isDuplicate = results.some(r => r.url === url);
                    if (!isDuplicate) {
                      results.push({
                        title: title,
                        url: url
                      });
                    }
                  }
                }
              } catch (error) {
              }
            });
          } else {
            items.forEach((item, index) => {
              try {
                const titleElement = item.querySelector('h3');
                const linkElement = item.querySelector('a');

                if (titleElement && linkElement && linkElement.href) {
                  const title = titleElement.textContent || '';
                  const url = linkElement.href;

                  if (!url.includes('google.com/search') &&
                      !url.includes('google.com/url?') &&
                      !url.startsWith('javascript:')) {
                    results.push({
                      title: title.trim(),
                      url: url
                    });
                  }
                }
              } catch (error) {
              }
            });
          }

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

export const googleProvider = new GoogleProvider();
