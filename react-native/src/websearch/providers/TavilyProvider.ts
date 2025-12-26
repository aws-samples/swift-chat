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

    try {
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
        throw new Error(
          `Tavily API error: ${response.status} ${response.statusText}`
        );
      }

      const data: TavilyApiResponse = await response.json();

      return data.results.slice(0, maxResults).map(result => ({
        title: result.title || 'No title',
        url: result.url || '',
        content: result.raw_content || result.content || '',
        excerpt: result.content || '',
      }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Tavily search failed: ${errorMessage}`);
    }
  }
}

export const tavilyProvider = new TavilyProvider();
