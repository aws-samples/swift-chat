/**
 * Web Search Orchestrator
 * Orchestrates all phases of web search and encapsulates search logic
 */

import { SystemPrompt, Citation } from '../../types/Chat';
import { BedrockMessage } from '../../chat/util/BedrockMessageConvertor';
import { SearchEngine, SearchEngineOption } from '../types';
import { intentAnalysisService } from './IntentAnalysisService';
import { webViewSearchService } from './WebViewSearchService';
import { contentFetchService } from './ContentFetchService';
import { promptBuilderService } from './PromptBuilderService';
import { getSearchProvider } from '../../storage/StorageUtils';
import { tavilyProvider } from '../providers/TavilyProvider';

/**
 * Web search phase enum
 */
export enum WebSearchPhase {
  ANALYZING = 'Analyzing search intent...',
  SEARCHING = 'Searching the web...',
  FETCHING = 'Fetching content...',
  BUILDING = 'Building enhanced prompt...',
}

/**
 * Web search result
 */
export interface WebSearchResult {
  systemPrompt: SystemPrompt | null;
  citations: Citation[];
}

/**
 * Web Search Orchestrator
 */
export class WebSearchOrchestrator {
  /**
   * Execute web search flow
   * @param userMessage User message
   * @param bedrockMessages Conversation history
   * @param onPhaseChange Phase change callback
   * @param searchEngine Optional search engine to use
   * @param abortController Optional abort controller to cancel the search
   * @returns Web search result with system prompt and citations, or null if search is not needed
   */
  async execute(
    userMessage: string,
    bedrockMessages: BedrockMessage[],
    onPhaseChange?: (phase: string) => void,
    searchEngine?: SearchEngine,
    abortController?: AbortController
  ): Promise<WebSearchResult | null> {
    try {
      const providerOption =
        searchEngine || (getSearchProvider() as SearchEngineOption);

      if (providerOption === 'disabled') {
        console.log('🔍 Web search is disabled by user');
        return null;
      }

      const engine = providerOption as SearchEngine;

      console.log('\n🔍 ========== WEB SEARCH START ==========');
      console.log(`Using search engine: ${engine}`);
      const start = performance.now();

      onPhaseChange?.(WebSearchPhase.ANALYZING);
      console.log('📝 Phase 1: Analyzing search intent...');

      // Check if aborted
      if (abortController?.signal.aborted) {
        console.log('⚠️  Web search aborted during phase 1');
        return null;
      }

      const intentResult = await intentAnalysisService.analyze(
        userMessage,
        bedrockMessages,
        abortController
      );

      const end1 = performance.now();
      console.log(`AI intent analysis time: ${end1 - start} ms`);

      if (!intentResult.needsSearch || intentResult.keywords.length === 0) {
        // Check if this is due to abort
        if (abortController?.signal.aborted) {
          console.log('⚠️  Web search aborted by user');
        } else {
          console.log('ℹ️  No search needed for this query');
        }
        console.log('========== WEB SEARCH END ==========\n');
        return null;
      }

      console.log('✅ Search needed! Keywords:', intentResult.keywords);

      // Phase 2: Execute web search
      onPhaseChange?.(WebSearchPhase.SEARCHING);
      const keyword = intentResult.keywords[0];
      console.log(
        `\n🌐 Phase 2: Searching for "${keyword}" using ${engine}...`
      );

      // Check if aborted
      if (abortController?.signal.aborted) {
        console.log('⚠️  Web search aborted during phase 2');
        return null;
      }

      let contents;
      let end3 = end1;

      // Tavily returns full content directly, skip fetch phase!
      if (engine === 'tavily') {
        contents = await tavilyProvider.search(keyword, 5, abortController);
        const end2 = performance.now();
        console.log(`Tavily API search time: ${end2 - end1} ms`);
        end3 = end2;
      } else {
        // Traditional search engines: get URLs then fetch content
        const searchResults = await webViewSearchService.search(
          keyword,
          engine,
          8,
          abortController
        );

        const end2 = performance.now();
        console.log(`WebView search time: ${end2 - end1} ms`);

        if (searchResults.length === 0) {
          console.log('\n⚠️  No search results found');
          console.log('========== WEB SEARCH END ==========\n');
          return null;
        }

        // Check if aborted
        if (abortController?.signal.aborted) {
          console.log('⚠️  Web search aborted during phase 3');
          return null;
        }

        // Phase 3: Fetch and parse content
        onPhaseChange?.(WebSearchPhase.FETCHING);
        console.log('\n📥 Phase 3: Fetching and parsing URL contents...');

        contents = await contentFetchService.fetchContents(
          searchResults,
          8000,
          10000,
          abortController
        );

        end3 = performance.now();
        console.log(`Concurrent fetch time: ${end3 - end2} ms`);
        console.log('\n✅ ========== FETCHED CONTENTS ==========');
        console.log('Successfully fetched:', contents.length);
      }

      if (contents.length === 0) {
        console.log('\n⚠️  No valid contents');
        console.log('========== WEB SEARCH END ==========\n');
        return null;
      }

      // Phase 4: Build enhanced prompt
      onPhaseChange?.(WebSearchPhase.BUILDING);
      const enhancedPrompt = promptBuilderService.buildPromptWithReferences(
        userMessage,
        contents
      );

      console.log('\n✅ Enhanced prompt built successfully');
      console.log(`Prompt length: ${enhancedPrompt.length} chars`);
      console.log(`References included: ${contents.length}`);
      console.log(`Total time: ${end3 - start} ms`);

      const webSearchSystemPrompt: SystemPrompt = {
        id: -999,
        name: 'Web Search References',
        prompt: enhancedPrompt,
        includeHistory: true,
      };

      const citations: Citation[] = contents.map((content, index) => ({
        number: index + 1,
        title: content.title,
        url: content.url,
        excerpt: content.excerpt,
      }));

      console.log('webSearchSystemPrompt length:' + enhancedPrompt.length);
      console.log(`✓ Citations extracted: ${citations.length}`);
      console.log('========== WEB SEARCH COMPLETE ==========\n');

      return {
        systemPrompt: webSearchSystemPrompt,
        citations: citations,
      };
    } catch (error: unknown) {
      // If aborted, log and return null gracefully
      if (
        error instanceof Error &&
        error.message === 'Search aborted by user'
      ) {
        console.log('⚠️  Web search aborted by user');
        console.log('========== WEB SEARCH END ==========\n');
        return null;
      }

      console.log('❌ Web search error:', error);
      console.log('⚠️  Falling back to normal chat flow');
      console.log('========== WEB SEARCH END ==========\n');
      return null;
    }
  }
}

export const webSearchOrchestrator = new WebSearchOrchestrator();
