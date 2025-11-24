/**
 * Content Fetch Service
 * 阶段4+5: 并发获取搜索结果URL的网页内容并解析
 */

import { SearchResultItem, WebContent } from '../types';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const NO_CONTENT = 'No content found';

/**
 * 验证URL是否合法
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * 获取单个URL的内容
 */
async function fetchSingleUrl(
  item: SearchResultItem,
  timeout: number = 30000
): Promise<WebContent> {
  try {
    // 验证URL
    if (!isValidUrl(item.url)) {
      throw new Error(`Invalid URL format: ${item.url}`);
    }

    console.log(`[ContentFetch] Fetching: ${item.url}`);

    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // 发起HTTP请求
      const start = performance.now();
      const response = await fetch(item.url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
        reactNative: { textStreaming: true },
      });
      const end1 = performance.now();
      console.log(`Fetch Cost: ${end1 - start} ms`);  
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // 获取HTML内容
      const html = await response.text();

      console.log(
        `[ContentFetch] ✓ Fetched: ${item.url} (${html.length} chars)`
      );

      // 使用 linkedom 解析 HTML 为 DOM
      console.log(`[ContentFetch] Parsing HTML with linkedom...`);
      const { document } = parseHTML(html, {
        url: item.url
      });

      // 使用 Readability 提取核心内容
      console.log(`[ContentFetch] Extracting content with Readability...`);
      const reader = new Readability(document);
      const article = reader.parse();

      if (!article || !article.content) {
        console.log(`[ContentFetch] ✗ No readable content found: ${item.url}`);
        return {
          title: item.title,
          url: item.url,
          content: NO_CONTENT,
        };
      }

      // 使用 Turndown 将 HTML 转换为 Markdown
      // 原因：Markdown 格式更简洁，占用 token 更少，且 AI 能更好地理解
      const htmlContent = article.content.trim();

      console.log(`[ContentFetch] Converting HTML to Markdown...`);

      const turndownService = new TurndownService();

      // 重新解析 article.content 为 DOM 节点，因为 turndown 需要 DOM 对象
      // 不能直接传 HTML 字符串给 turndown，因为 React Native 环境中缺少完整的浏览器 API
      // 注意：parseHTML 返回的 document.body 可能是空的，要直接传 document
      const contentParsed = parseHTML(htmlContent) as any;
      const contentDoc = contentParsed.document;

      const markdownContent = turndownService.turndown(contentDoc);

      console.log(`[ContentFetch] ✓ Extracted: ${item.url}`);
      console.log(`[ContentFetch]   - Title: ${article.title}`);
      console.log(`[ContentFetch]   - HTML length: ${htmlContent.length} chars`);
      console.log(`[ContentFetch]   - Markdown length: ${markdownContent.length} chars`);
      console.log(`[ContentFetch]   - Token savings: ${((1 - markdownContent.length / htmlContent.length) * 100).toFixed(1)}%`);
      console.log(`[ContentFetch]   - Excerpt: ${article.excerpt?.substring(0, 100) || 'N/A'}...`);
      const end2 = performance.now();
      console.log(`Parse Cost: ${end2 - end1} ms`);
      return {
        title: article.title || item.title,
        url: item.url,
        content: markdownContent || NO_CONTENT,
        excerpt: article.excerpt || NO_CONTENT,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error: any) {
    // 处理超时或网络错误
    if (error.name === 'AbortError') {
      console.log(`[ContentFetch] ✗ Timeout: ${item.url}`);
    } else {
      console.log(`[ContentFetch] ✗ Error: ${item.url}`, error.message);
    }

    return {
      title: item.title,
      url: item.url,
      content: NO_CONTENT,
    };
  }
}

/**
 * 内容获取服务
 */
export class ContentFetchService {
  /**
   * 并发获取多个URL的内容
   * @param items 搜索结果项列表
   * @param timeout 每个请求的超时时间（毫秒）
   * @param maxCharsPerResult 每个结果的最大字符数
   * @returns 解析后的网页内容列表
   */
  async fetchContents(
    items: SearchResultItem[],
    timeout: number = 30000,
    maxCharsPerResult: number = 5000
  ): Promise<WebContent[]> {
    console.log('\n========================================');
    console.log('[ContentFetch] Starting concurrent fetch');
    console.log(`[ContentFetch] URLs to fetch: ${items.length}`);
    console.log(`[ContentFetch] Timeout: ${timeout}ms per URL`);
    console.log(`[ContentFetch] Max chars per result: ${maxCharsPerResult}`);
    console.log('========================================\n');

    try {
      // 并发获取所有URL的内容
      const fetchPromises = items.map(item => fetchSingleUrl(item, timeout));

      // 使用Promise.allSettled等待所有请求完成
      // 即使某些请求失败，也不会影响其他请求
      const results = await Promise.allSettled(fetchPromises);

      // 处理结果
      const contents: WebContent[] = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          const content = result.value;
          // 截断过长的内容
          if (content.content.length > maxCharsPerResult) {
            content.content = content.content.slice(0, maxCharsPerResult) + '...';
          }
          return content;
        } else {
          // 失败的请求返回NO_CONTENT
          return {
            title: items[index].title,
            url: items[index].url,
            content: NO_CONTENT,
          };
        }
      });

      // 过滤掉没有内容的结果
      const validContents = contents.filter(c => c.content !== NO_CONTENT);

      console.log('\n========================================');
      console.log('[ContentFetch] Fetch complete');
      console.log(`[ContentFetch] Success: ${validContents.length}/${items.length}`);
      console.log('========================================\n');

      return validContents;
    } catch (error) {
      console.error('[ContentFetch] Fatal error:', error);
      // 发生致命错误时返回空数组
      return [];
    }
  }
}

/**
 * 单例实例
 */
export const contentFetchService = new ContentFetchService();
