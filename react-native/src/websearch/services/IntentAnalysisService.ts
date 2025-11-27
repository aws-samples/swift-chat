/**
 * Intent Analysis Service
 * Phase 1: Analyze user intent and extract search keywords
 */

import { BedrockMessage } from '../../chat/util/BedrockMessageConvertor';
import { SearchIntentResult } from '../types';
import { invokeBedrockWithCallBack } from '../../api/bedrock-api';
import { ChatMode } from '../../types/Chat';
import { jsonrepair } from 'jsonrepair';

const INTENT_ANALYSIS_PROMPT = `You are an AI question rephraser. Your role is to rephrase follow-up queries from a conversation into standalone queries that can be used to retrieve information through web search.

## Guidelines:
1. If the question is a simple writing task, greeting, or general conversation, set "need_search" to false
2. If the user asks about specific URLs, include them in the "links" array
3. Extract search keywords into the "question" array, and use the SAME LANGUAGE as the user's question
4. For comparative questions, create multiple queries
5. ONLY respond with valid JSON format, no other text or markdown code blocks

## Output Format:
{
  "need_search": boolean,
  "question": string[],
  "links": string[]
}

## Examples:

Input: "Hello, how are you?"
Output:
{
  "need_search": false,
  "question": [],
  "links": []
}

Input: "Write a story about a cat"
Output:
{
  "need_search": false,
  "question": [],
  "links": []
}

Input: "What's the weather in Tokyo today?"
Output:
{
  "need_search": true,
  "question": ["Tokyo weather today"],
  "links": []
}

Input: "今天北京天气怎么样？"
Output:
{
  "need_search": true,
  "question": ["北京天气"],
  "links": []
}

Input: "Which company had higher revenue in 2022, Amazon or Google?"
Output:
{
  "need_search": true,
  "question": ["Amazon revenue 2022", "Google revenue 2022"],
  "links": []
}

Input: "Summarize this doc: https://example.com/doc"
Output:
{
  "need_search": true,
  "question": [],
  "links": ["https://example.com/doc"]
}

Now analyze this conversation and extract search queries if needed. Respond with ONLY valid JSON, no other text.`;

function extractInfoFromJSON(response: string): SearchIntentResult {

  try {
    const repairedJson = jsonrepair(response);
    const parsed = JSON.parse(repairedJson);

    const result: SearchIntentResult = {
      needsSearch: parsed.need_search === true,
      keywords: Array.isArray(parsed.question) ? parsed.question : [],
      links: Array.isArray(parsed.links) && parsed.links.length > 0 ? parsed.links : undefined,
    };
    return result;
  } catch (error) {
    console.error('[IntentAnalysis] Failed to parse JSON:', error);
    console.log('[IntentAnalysis] Falling back to: no search needed');
    return {
      needsSearch: false,
      keywords: [],
    };
  }
}

export class IntentAnalysisService {
  async analyze(
    userMessage: string,
    conversationHistory: BedrockMessage[]
  ): Promise<SearchIntentResult> {
    console.log('\n========================================');
    console.log('[IntentAnalysis] Starting intent analysis');
    console.log('[IntentAnalysis] User message:', userMessage);
    console.log('========================================\n');

    try {
      const messages: BedrockMessage[] = [
        {
          role: 'user',
          content: [
            {
              text: INTENT_ANALYSIS_PROMPT,
            },
            {
              text: `\n\n## Conversation History:\n${this.formatConversationHistory(conversationHistory)}`,
            },
            {
              text: `\n\n## Current User Question:\n${userMessage}`,
            },
          ],
        },
      ];

      const fullResponse = await this.invokeModelSync(messages);

      console.log('\n[IntentAnalysis] Full response received');
      console.log('[IntentAnalysis] Response length:', fullResponse.length);

      const result = extractInfoFromJSON(fullResponse);

      console.log('\n========================================');
      console.log('[IntentAnalysis] Analysis complete');
      console.log('[IntentAnalysis] Needs search:', result.needsSearch);
      console.log('[IntentAnalysis] Keywords:', result.keywords);
      if (result.links) {
        console.log('[IntentAnalysis] Links:', result.links);
      }
      console.log('========================================\n');

      return result;
    } catch (error) {
      console.error('[IntentAnalysis] Error:', error);
      return { needsSearch: false, keywords: [] };
    }
  }

  private async invokeModelSync(messages: BedrockMessage[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let fullResponse = '';
      const controller = new AbortController();

      invokeBedrockWithCallBack(
        messages,
        ChatMode.Text,
        null,
        () => false,
        controller,
        (text: string, complete: boolean, needStop: boolean) => {
          fullResponse = text;

          if (!complete) {
            console.log(".")
          }

          if (complete || needStop) {
            if (needStop) {
              reject(new Error('Request stopped'));
            } else {
              resolve(fullResponse);
            }
          }
        }
      ).catch(reject);
    });
  }

  private formatConversationHistory(messages: BedrockMessage[]): string {
    if (messages.length === 0) {
      return 'No previous conversation';
    }

    const recentMessages = messages.slice(-6);

    return recentMessages
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        let text = '';

        if (Array.isArray(msg.content)) {
          text = msg.content
            .filter(c => 'text' in c)
            .map(c => (c as any).text)
            .join(' ');
        } else if (typeof msg.content === 'string') {
          text = msg.content;
        }

        if (text.length > 200) {
          text = text.slice(0, 200) + '...';
        }

        return `${role}: ${text}`;
      })
      .join('\n');
  }
}

export const intentAnalysisService = new IntentAnalysisService();
