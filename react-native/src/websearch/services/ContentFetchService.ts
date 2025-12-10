/**
 * Content Fetch Service
 * Phase 4+5: Concurrently fetch and parse web content from search results
 */

import { SearchResultItem, WebContent } from '../types';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const NO_CONTENT = 'No content found';

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

async function fetchSingleUrl(
  item: SearchResultItem,
  timeout: number = 30000,
  globalAbortController?: AbortController
): Promise<WebContent> {
  try {
    if (!isValidUrl(item.url)) {
      throw new Error(`Invalid URL format: ${item.url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const globalAbortListener = () => controller.abort();
    globalAbortController?.signal.addEventListener(
      'abort',
      globalAbortListener
    );

    try {
      const response = await fetch(item.url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
        redirect: 'follow',
        // @ts-expect-error - reactNative.textStreaming is a React Native specific option
        reactNative: { textStreaming: true },
      });

      clearTimeout(timeoutId);
      globalAbortController?.signal.removeEventListener(
        'abort',
        globalAbortListener
      );

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const finalUrl = response.url || item.url;
      const html = await response.text();

      const isCaptchaPage = finalUrl.includes('baidu.com/static/captcha');
      if (isCaptchaPage) {
        return {
          title: item.title,
          url: finalUrl,
          content: NO_CONTENT,
        };
      }

      const MAX_HTML_SIZE = 2 * 1024 * 1024;
      if (html.length > MAX_HTML_SIZE) {
        return {
          title: item.title,
          url: finalUrl,
          content: NO_CONTENT,
        };
      }

      if (globalAbortController?.signal.aborted) {
        throw new Error('Aborted');
      }

      const { document } = parseHTML(html, {
        url: finalUrl,
      }) as unknown as { document: Document };

      if (globalAbortController?.signal.aborted) {
        throw new Error('Aborted');
      }

      const reader = new Readability(document);
      const article = reader.parse();

      if (!article || !article.content) {
        return {
          title: item.title,
          url: finalUrl,
          content: NO_CONTENT,
        };
      }

      const htmlContent = article.content.trim();

      if (globalAbortController?.signal.aborted) {
        throw new Error('Aborted');
      }

      const turndownService = new TurndownService();
      const contentParsed = parseHTML(htmlContent);
      const contentDoc = (contentParsed as unknown as { document: Document })
        .document;
      const markdownContent = turndownService.turndown(contentDoc);

      return {
        title: article.title || item.title,
        url: finalUrl,
        content: markdownContent || NO_CONTENT,
        excerpt: article.excerpt || NO_CONTENT,
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      globalAbortController?.signal.removeEventListener(
        'abort',
        globalAbortListener
      );
      throw error;
    }
  } catch (error: unknown) {
    return {
      title: item.title,
      url: item.url,
      content: NO_CONTENT,
    };
  }
}

export class ContentFetchService {
  async fetchContents(
    items: SearchResultItem[],
    timeout: number = 8000,
    maxCharsPerResult: number = 3000,
    abortController?: AbortController
  ): Promise<WebContent[]> {
    try {
      if (abortController?.signal.aborted) {
        return [];
      }

      const extendedItems = items.slice(0, 8);
      const top3Indices = new Set([0, 1, 2]);

      const globalAbortController = new AbortController();

      const abortListener = () => {
        globalAbortController.abort();
      };
      abortController?.signal.addEventListener('abort', abortListener);

      const fetchPromises = extendedItems.map((item, index) =>
        fetchSingleUrl(item, timeout, globalAbortController).then(content => ({
          content,
          index,
        }))
      );

      const completedResults: Array<{ content: WebContent; index: number }> =
        [];
      let top3Count = 0;

      const remaining = [...fetchPromises];

      while (
        remaining.length > 0 &&
        completedResults.length < extendedItems.length
      ) {
        try {
          const result = await Promise.race(remaining);

          const completedIndex = remaining.findIndex(
            p => p === fetchPromises[result.index]
          );
          if (completedIndex !== -1) {
            remaining.splice(completedIndex, 1);
          }

          if (result.content.content !== NO_CONTENT) {
            completedResults.push(result);

            if (top3Indices.has(result.index)) {
              top3Count++;
            }

            const totalCompleted = completedResults.length;

            if (top3Count === 3 && totalCompleted >= 3) {
              globalAbortController.abort();
              break;
            } else if (top3Count === 2 && totalCompleted >= 4) {
              globalAbortController.abort();
              break;
            } else if (totalCompleted >= 6) {
              globalAbortController.abort();
              break;
            }
          }
        } catch (error) {
          // Continue on error
        }
      }

      const validContents = completedResults.map(r => {
        const content = r.content;
        if (content.content.length > maxCharsPerResult) {
          content.content = content.content.slice(0, maxCharsPerResult) + '...';
        }
        return content;
      });

      let finalContents: WebContent[];
      if (top3Count === 3) {
        finalContents = validContents.slice(0, 3);
      } else if (top3Count === 2 && validContents.length >= 4) {
        finalContents = validContents.slice(0, 4);
      } else {
        finalContents = validContents.slice(
          0,
          Math.min(5, validContents.length)
        );
      }

      abortController?.signal.removeEventListener('abort', abortListener);

      return finalContents;
    } catch (error) {
      return [];
    }
  }
}

export const contentFetchService = new ContentFetchService();
