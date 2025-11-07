/**
 * Web Search Orchestrator
 * 统一协调整个Web搜索流程
 */

import { BedrockMessage } from '../../chat/util/BedrockMessageConvertor';
import { SearchProgressCallback, WebSearchConfig, WebSearchResult } from '../types';
import { intentAnalysisService } from './IntentAnalysisService';
import { webViewSearchService } from './WebViewSearchService';
import { contentFetchService } from './ContentFetchService';
import { promptBuilderService } from './PromptBuilderService';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: WebSearchConfig = {
  engine: 'google',
  maxResults: 5,
  maxCharsPerResult: 5000,
  timeout: 30000,
};

/**
 * Web搜索编排器
 */
export class WebSearchOrchestrator {
  private config: WebSearchConfig;

  constructor(config: Partial<WebSearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行完整的Web搜索流程
   * @param userMessage 用户输入
   * @param conversationHistory 对话历史
   * @param onProgress 进度回调
   * @returns 完整的搜索结果
   */
  async search(
    userMessage: string,
    conversationHistory: BedrockMessage[] = [],
    onProgress?: SearchProgressCallback
  ): Promise<WebSearchResult | null> {
    try {
      // 阶段1: 意图分析
      onProgress?.('intent_analysis', '正在分析搜索意图...');
      const intentResult = await intentAnalysisService.analyze(
        userMessage,
        conversationHistory
      );

      if (!intentResult.needsSearch) {
        console.log('[WebSearch] No search needed, skipping');
        return null;
      }

      // 获取第一个关键词进行搜索
      const keyword = intentResult.keywords[0];
      if (!keyword) {
        console.log('[WebSearch] No keywords found, skipping');
        return null;
      }

      // 阶段2: WebView搜索
      onProgress?.('webview_search', `正在搜索: ${keyword}...`);
      const searchItems = await webViewSearchService.search(keyword);

      if (!searchItems || searchItems.length === 0) {
        console.log('[WebSearch] No search results found');
        return {
          originalQuery: userMessage,
          keywords: intentResult.keywords,
          items: [],
        };
      }

      // 限制结果数量
      const limitedItems = searchItems.slice(0, this.config.maxResults);

      // 阶段4-5: 并发获取网页内容并解析为Markdown
      onProgress?.(
        'content_fetch',
        `正在获取 ${limitedItems.length} 个网页内容...`
      );
      const contents = await contentFetchService.fetchContents(
        limitedItems,
        this.config.timeout,
        this.config.maxCharsPerResult
      );

      if (contents.length === 0) {
        console.log('[WebSearch] No valid content fetched');
        return {
          originalQuery: userMessage,
          keywords: intentResult.keywords,
          items: limitedItems,
          contents: [],
        };
      }

      // 阶段6: 构建带引用的Prompt
      onProgress?.('build_prompt', '正在构建增强提示...');
      const enhancedPrompt = promptBuilderService.buildPromptWithReferences(
        userMessage,
        contents
      );

      onProgress?.('complete', '搜索完成');

      return {
        originalQuery: userMessage,
        keywords: intentResult.keywords,
        items: limitedItems,
        contents,
        enhancedPrompt,
      };
    } catch (error) {
      console.error('[WebSearch] Search failed:', error);
      throw error;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<WebSearchConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): WebSearchConfig {
    return { ...this.config };
  }
}

/**
 * 单例实例
 */
export const webSearchOrchestrator = new WebSearchOrchestrator();
