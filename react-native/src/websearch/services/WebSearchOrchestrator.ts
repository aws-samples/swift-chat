/**
 * Web Search Orchestrator
 * Orchestrates all phases of web search and encapsulates search logic
 */

import { SystemPrompt, Citation } from '../../types/Chat';
import { BedrockMessage } from '../../chat/util/BedrockMessageConvertor';
import { intentAnalysisService } from './IntentAnalysisService';
import { webViewSearchService } from './WebViewSearchService';
import { contentFetchService } from './ContentFetchService';
import { promptBuilderService } from './PromptBuilderService';

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
   * @returns Web search result with system prompt and citations, or null if search is not needed
   */
  async execute(
    userMessage: string,
    bedrockMessages: BedrockMessage[],
    onPhaseChange?: (phase: string) => void
  ): Promise<WebSearchResult | null> {
    try {
      console.log('\n🔍 ========== WEB SEARCH START ==========');
      const start = performance.now();

      // Phase 1: Analyze search intent
      onPhaseChange?.(WebSearchPhase.ANALYZING);
      console.log('📝 Phase 1: Analyzing search intent...');

      const intentResult = await intentAnalysisService.analyze(
        userMessage,
        bedrockMessages
      );

      const end1 = performance.now();
      console.log(`AI intent analysis time: ${end1 - start} ms`);

      // Return if search is not needed
      if (!intentResult.needsSearch || intentResult.keywords.length === 0) {
        console.log('ℹ️  No search needed for this query');
        console.log('========== WEB SEARCH END ==========\n');
        return null;
      }

      console.log('✅ Search needed! Keywords:', intentResult.keywords);

      // Phase 2: Execute web search
      onPhaseChange?.(WebSearchPhase.SEARCHING);
      const keyword = intentResult.keywords[0];
      console.log(`\n🌐 Phase 2: Searching for "${keyword}"...`);

      const searchResults = await webViewSearchService.search(
        keyword,
        'google',
        5
      );

      const end2 = performance.now();
      console.log(`WebView search time: ${end2 - end1} ms`);
      console.log('\n✅ ========== WEB SEARCH RESULTS ==========');
      console.log('Total results:', searchResults.length);
      searchResults.forEach((result, index) => {
        console.log(`\n[${index + 1}] ${result.title}`);
        console.log(`    URL: ${result.url}`);
      });

      // Return if no search results
      if (searchResults.length === 0) {
        console.log('\n⚠️  No search results found');
        console.log('========== WEB SEARCH END ==========\n');
        return null;
      }

      // Phase 3: Fetch and parse content
      onPhaseChange?.(WebSearchPhase.FETCHING);
      console.log('\n📥 Phase 3: Fetching and parsing URL contents...');

      const contents = await contentFetchService.fetchContents(
        searchResults,
        30000, // 30s timeout
        5000 // Max 5000 chars per result
      );

      const end3 = performance.now();
      console.log(`Concurrent fetch time: ${end3 - end2} ms`);
      console.log('\n✅ ========== FETCHED CONTENTS ==========');
      console.log('Successfully fetched:', contents.length);

      // Return if no valid content
      if (contents.length === 0) {
        console.log('\n⚠️  No valid contents fetched');
        console.log('========== WEB SEARCH END ==========\n');
        return null;
      }

      // Phase 4: Build enhanced prompt
      onPhaseChange?.(WebSearchPhase.BUILDING);
      console.log('\n📝 Phase 4: Building enhanced prompt with references...');

      const enhancedPrompt = promptBuilderService.buildPromptWithReferences(
        userMessage,
        contents
      );

      console.log('\n✅ Enhanced prompt built successfully');
      console.log(`Prompt length: ${enhancedPrompt.length} chars`);
      console.log(`References included: ${contents.length}`);
      console.log(`Total time: ${end3 - start} ms`);

      // Create temporary SystemPrompt
      const webSearchSystemPrompt: SystemPrompt = {
        id: -999, // Special ID to identify web search generated prompt
        name: 'Web Search References',
        prompt: enhancedPrompt,
        includeHistory: true,
      };

      // Extract citations from contents
      const citations: Citation[] = contents.map((content, index) => ({
        number: index + 1,
        title: content.title,
        url: content.url,
        excerpt: content.excerpt,
      }));

      console.log('webSearchSystemPrompt length:' + enhancedPrompt.length);
      console.log('✓ Web search system prompt created');
      console.log(`✓ Citations extracted: ${citations.length}`);
      console.log('========== WEB SEARCH COMPLETE ==========\n');

      return {
        systemPrompt: webSearchSystemPrompt,
        citations: citations,
      };
    } catch (error: any) {
      console.log('❌ Web search error:', error);
      console.log('⚠️  Falling back to normal chat flow');
      console.log('========== WEB SEARCH END ==========\n');
      return null;
    }
  }
}

/**
 * Global singleton instance
 */
export const webSearchOrchestrator = new WebSearchOrchestrator();
