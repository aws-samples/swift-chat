import { SearchProviderConfig, SearchEngineOption } from '../types';

export const SEARCH_PROVIDER_CONFIGS: SearchProviderConfig[] = [
  { id: 'disabled', name: 'Disable', description: 'No web search' },
  { id: 'google', name: 'Google', description: 'Search with Google' },
  { id: 'bing', name: 'Bing', description: 'Search with Bing' },
  { id: 'baidu', name: 'Baidu', description: 'Search with Baidu' }
];

export const DEFAULT_SEARCH_PROVIDER: SearchEngineOption = 'baidu';
