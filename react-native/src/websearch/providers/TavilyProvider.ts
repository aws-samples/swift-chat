/**
 * Tavily Search Provider
 * Uses Tavily API directly for web search with raw content
 */

import { WebContent } from '../types';
import { getTavilyApiKey } from '../../storage/StorageUtils';

interface TavilySearchResult {
  url: string;
  title: string;
  content: string;
  score: number;
  raw_content: string | null;
}

interface TavilyApiResponse {
  query: string;
  follow_up_questions: string[] | null;
  answer: string;
  images: string[];
  results: TavilySearchResult[];
}

export class TavilyProvider {
  readonly name = 'Tavily';
  private readonly apiHost = 'https://api.tavily.com';

  /**
   * Perform Tavily search via API with raw content
   * @param query Search query
   * @param maxResults Maximum number of results (default: 5)
   * @param abortController Optional abort controller to cancel the search
   * @returns Array of search results with full content (skips fetch phase)
   */
  async search(
    query: string,
    maxResults: number = 5,
    abortController?: AbortController
  ): Promise<WebContent[]> {
    const apiKey = getTavilyApiKey();

    if (!apiKey) {
      throw new Error('Tavily API key is not configured');
    }

    console.log('\n========================================');
    console.log('[TavilyProvider] Starting API search');
    console.log('[TavilyProvider] Query:', query);
    console.log('[TavilyProvider] Max results:', maxResults);
    console.log('========================================\n');

    try {
      // Check if aborted before starting
      if (abortController?.signal.aborted) {
        throw new Error('Search aborted by user');
      }

      const response = await fetch(`${this.apiHost}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: abortController?.signal,
        reactNative: { textStreaming: true },
        body: JSON.stringify({
          query,
          max_results: maxResults,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(
          '[TavilyProvider] API error:',
          response.status,
          errorText
        );
        throw new Error(
          `Tavily API error: ${response.status} ${response.statusText}`
        );
      }

      const data: TavilyApiResponse = await response.json();

      // Transform Tavily results to WebContent format with full content
      // This allows skipping the fetch phase entirely!
      return data.results.slice(0, maxResults).map(result => ({
        title: result.title || 'No title',
        url: result.url || '',
        content: result.raw_content || result.content || '', // Use raw_content if available, fallback to summary
        excerpt: result.content || '', // Summary as excerpt
      }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.log('[TavilyProvider] Search failed:', errorMessage);
      throw new Error(`Tavily search failed: ${errorMessage}`);
    }
  }
}

export const tavilyProvider = new TavilyProvider();
