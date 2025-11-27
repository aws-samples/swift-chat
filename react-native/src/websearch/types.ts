/**
 * Web Search Types
 */

export type SearchEngine = 'google' | 'bing' | 'baidu';

export type SearchEngineOption = 'disabled' | SearchEngine;

export interface SearchProviderConfig {
  id: SearchEngineOption;
  name: string;
  description?: string;
}

export interface SearchIntentResult {
  needsSearch: boolean;
  keywords: string[];
  links?: string[];
}

export interface SearchResultItem {
  title: string;
  url: string;
}

export interface WebContent {
  title: string;
  url: string;
  content: string;
  excerpt?: string;
}

export interface WebSearchResult {
  originalQuery: string;
  keywords: string[];
  items: SearchResultItem[];
  contents?: WebContent[];
  enhancedPrompt?: string;
}

export interface WebSearchConfig {
  engine: SearchEngine;
  maxResults: number;
  maxCharsPerResult: number;
  timeout: number;
}

export type SearchProgressCallback = (stage: string, message: string) => void;
