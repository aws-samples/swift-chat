/**
 * Google Search Provider
 * Google搜索引擎的DOM选择器和URL生成
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
  /**
   * 搜索引擎名称
   */
  readonly name = 'Google';

  /**
   * 生成搜索URL
   */
  getSearchUrl(query: string): string {
    const encodedQuery = encodeURIComponent(query);
    return `https://www.google.com/search?q=${encodedQuery}`;
  }

  /**
   * 生成注入的JavaScript代码，用于提取搜索结果
   */
  getExtractionScript(): string {
    return `
      (function() {
        try {
          // 检查是否包含搜索结果的关键字
          const fullHTML = document.documentElement.outerHTML;
          const hasCaptcha = fullHTML.includes('captcha') || fullHTML.includes('recaptcha');
          const hasRobotCheck = fullHTML.toLowerCase().includes('unusual traffic') || fullHTML.toLowerCase().includes('automated');

          // 检查是否有实际内容（h3标题元素是搜索结果的强信号）
          const h3Count = document.querySelectorAll('h3').length;
          const hasActualContent = h3Count >= 3; // 至少3个h3元素表示有实际搜索结果

          // 只有在明确检测到CAPTCHA标识，且没有实际内容时，才判定为CAPTCHA页面
          // 避免因HTML结构变化导致的误判
          if ((hasCaptcha || hasRobotCheck) || !hasActualContent) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'captcha_required',
              message: 'CAPTCHA verification required'
            }));
            return; // 暂停处理，等待用户完成验证
          }

          const results = [];

          // 尝试多个可能的选择器（2025年最新）
          const selectors = [
            '#search .MjjYud',           // 2024版
            '#search .g',                // 经典版
            '#rso .g',                   // 另一个常见版本
            '.hlcw0c',                   // 变体1
            '[data-sokoban-container]',  // 变体2
            'div[data-hveid] > div > div', // 2025新版
            '#rso > div',                // 简化版
            '.v7W49e',                   // 可能的新class
            '.tF2Cxc',                   // 另一个可能的class
            '.Gx5Zad'                    // 备选class
          ];

          let items = null;

          for (const selector of selectors) {
            items = document.querySelectorAll(selector);
            if (items && items.length > 0) {
              break;
            }
          }

          if (!items || items.length === 0) {
            // Fallback: 直接查找所有h3标签（通常是搜索结果标题）
            const h3Elements = document.querySelectorAll('h3');

            // 遍历h3元素，找到父级的a链接
            h3Elements.forEach((h3) => {
              try {
                // h3可能在a标签内，或者a标签在h3的父级
                let linkElement = h3.closest('a');
                if (!linkElement) {
                  // 尝试在父元素中查找a标签
                  const parent = h3.parentElement;
                  if (parent) {
                    linkElement = parent.querySelector('a');
                  }
                }

                if (linkElement && linkElement.href && h3.textContent) {
                  const url = linkElement.href;
                  const title = h3.textContent.trim();

                  // 过滤掉Google内部链接和空标题
                  if (title &&
                      !url.includes('google.com/search') &&
                      !url.includes('google.com/url?') &&
                      !url.includes('google.com/settings') &&
                      !url.includes('accounts.google') &&
                      !url.startsWith('javascript:')) {

                    // 避免重复
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
                // 忽略单个元素的错误
              }
            });
          } else {
            // 使用找到的选择器提取结果
            items.forEach((item, index) => {
              try {
                const titleElement = item.querySelector('h3');
                const linkElement = item.querySelector('a');

                if (titleElement && linkElement && linkElement.href) {
                  const title = titleElement.textContent || '';
                  const url = linkElement.href;

                  // 过滤掉Google内部链接
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
                // 忽略单个元素的错误
              }
            });
          }

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

export const googleProvider = new GoogleProvider();
