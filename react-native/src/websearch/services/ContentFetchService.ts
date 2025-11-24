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

      // 优化1: 限制HTML大小，避免解析超大HTML
      const MAX_HTML_SIZE = 200 * 1024; // 200KB
      if (html.length > MAX_HTML_SIZE) {
        console.log(`[ContentFetch] ⚠️  HTML too large (${(html.length / 1024).toFixed(0)}KB), skipping to avoid slow parsing`);
        return {
          title: item.title,
          url: item.url,
          content: NO_CONTENT,
        };
      }

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
   * 并发获取多个URL的内容（智能Early Exit）
   * @param items 搜索结果项列表
   * @param timeout 每个请求的超时时间（毫秒）
   * @param maxCharsPerResult 每个结果的最大字符数（建议3000以控制总大小在50KB内）
   * @returns 解析后的网页内容列表
   */
  async fetchContents(
    items: SearchResultItem[],
    timeout: number = 8000,
    maxCharsPerResult: number = 3000
  ): Promise<WebContent[]> {
    console.log('\n========================================');
    console.log('[ContentFetch] Starting smart concurrent fetch');
    console.log(`[ContentFetch] URLs to fetch: ${items.length}`);
    console.log(`[ContentFetch] Timeout: ${timeout}ms per URL`);
    console.log(`[ContentFetch] Max chars per result: ${maxCharsPerResult}`);
    console.log('========================================\n');

    const startTime = performance.now();

    try {
      // 扩展搜索结果到8个（如果不足8个则用原数组）
      const extendedItems = items.slice(0, 8);
      const top3Indices = new Set([0, 1, 2]); // 前3名的索引

      console.log(`[ContentFetch] Top3 URLs (priority):`);
      extendedItems.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.url}`);
      });

      // 启动所有fetch任务
      const fetchPromises = extendedItems.map((item, index) =>
        fetchSingleUrl(item, timeout).then(content => ({ content, index }))
      );

      // 动态收集完成的结果
      const completedResults: Array<{ content: WebContent; index: number }> = [];
      let top3Count = 0; // 前3名完成的数量

      // 使用Promise.race逐个等待完成
      const remaining = [...fetchPromises];

      while (remaining.length > 0 && completedResults.length < extendedItems.length) {
        try {
          const result = await Promise.race(remaining);

          // 从remaining中移除已完成的Promise
          const completedIndex = remaining.findIndex(p => p === fetchPromises[result.index]);
          if (completedIndex !== -1) {
            remaining.splice(completedIndex, 1);
          }

          // 只保留有效内容
          if (result.content.content !== NO_CONTENT) {
            completedResults.push(result);

            // 统计前3名完成数
            if (top3Indices.has(result.index)) {
              top3Count++;
            }

            const totalCompleted = completedResults.length;
            console.log(`[ContentFetch] ✓ Completed: ${totalCompleted}/${extendedItems.length}, Top3: ${top3Count}/3`);

            // 智能退出逻辑
            if (top3Count === 3 && totalCompleted >= 3) {
              // 最优：前3名都完成了，至少有3个结果
              console.log(`[ContentFetch] ⚡ Early exit: All top3 completed with ${totalCompleted} results`);
              break;
            } else if (top3Count === 2 && totalCompleted >= 4) {
              // 良好：前3名完成了2个，且总共有4个结果
              console.log(`[ContentFetch] ⚡ Early exit: 2/3 top3 completed with ${totalCompleted} results`);
              break;
            } else if (totalCompleted >= 6) {
              // 可接受：已完成6个，取前5个
              console.log(`[ContentFetch] ⚡ Early exit: 6 URLs completed, using top 5`);
              break;
            }
          }
        } catch (error) {
          // 单个请求失败，继续处理其他
          console.log(`[ContentFetch] ⚠️  One request failed, continuing...`);
        }
      }

      // 按完成顺序排序（已经是按完成时间的顺序）
      const validContents = completedResults.map(r => {
        const content = r.content;
        // 截断过长的内容
        if (content.content.length > maxCharsPerResult) {
          content.content = content.content.slice(0, maxCharsPerResult) + '...';
        }
        return content;
      });

      // 根据退出条件选择返回数量
      let finalContents: WebContent[];
      if (top3Count === 3) {
        // 最优：前3名都完成了，返回前3个
        finalContents = validContents.slice(0, 3);
      } else if (top3Count === 2 && validContents.length >= 4) {
        // 良好：前3名完成2个，返回前4个
        finalContents = validContents.slice(0, 4);
      } else {
        // 可接受/兜底：完成6个或更多，返回前5个
        finalContents = validContents.slice(0, Math.min(5, validContents.length));
      }

      const endTime = performance.now();
      const totalTime = (endTime - startTime).toFixed(0);

      console.log('\n========================================');
      console.log('[ContentFetch] Smart fetch complete');
      console.log(`[ContentFetch] Completed: ${validContents.length}/${extendedItems.length}`);
      console.log(`[ContentFetch] Top3 hits: ${top3Count}/3`);
      console.log(`[ContentFetch] Returned: ${finalContents.length} results`);
      console.log(`[ContentFetch] Total time: ${totalTime}ms`);
      console.log('========================================\n');

      return finalContents;
    } catch (error) {
      console.error('[ContentFetch] Fatal error:', error);
      return [];
    }
  }
}

/**
 * 单例实例
 */
export const contentFetchService = new ContentFetchService();
