/**
 * Web Search Types
 * 定义整个web search功能所需的类型
 */

/**
 * 搜索引擎类型
 */
export type SearchEngine = 'google' | 'bing' | 'baidu';

/**
 * Extended search engine type with disabled option
 */
export type SearchEngineOption = 'disabled' | SearchEngine;

/**
 * Search provider configuration for UI
 */
export interface SearchProviderConfig {
  id: SearchEngineOption;
  name: string;
  description?: string;
}

/**
 * 搜索意图分析结果
 */
export interface SearchIntentResult {
  /** 是否需要搜索 */
  needsSearch: boolean;
  /** 提取的搜索关键词列表 */
  keywords: string[];
  /** 可选的相关链接 */
  links?: string[];
}

/**
 * 搜索结果项
 */
export interface SearchResultItem {
  /** 标题 */
  title: string;
  /** URL */
  url: string;
}

/**
 * 网页内容
 */
export interface WebContent {
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** Markdown格式的内容 */
  content: string;
  /** 简介/摘要 */
  excerpt?: string;
}

/**
 * 最终的搜索结果
 */
export interface WebSearchResult {
  /** 原始问题 */
  originalQuery: string;
  /** 提取的关键词 */
  keywords: string[];
  /** 搜索结果项 */
  items: SearchResultItem[];
  /** 解析后的网页内容（阶段5使用） */
  contents?: WebContent[];
  /** 增强后的prompt（阶段6使用） */
  enhancedPrompt?: string;
}

/**
 * Web Search配置
 */
export interface WebSearchConfig {
  /** 搜索引擎 */
  engine: SearchEngine;
  /** 最大结果数 */
  maxResults: number;
  /** 每个结果的最大字符数 */
  maxCharsPerResult: number;
  /** 超时时间（毫秒） */
  timeout: number;
}

/**
 * 搜索进度回调
 */
export type SearchProgressCallback = (stage: string, message: string) => void;
