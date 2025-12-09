/**
 * Prompt Builder Service
 * Phase 6: Build final prompt with references
 */

import { WebContent } from '../types';

interface FormattedReference {
  number: number;
  title: string;
  url: string;
  content: string;
}

export class PromptBuilderService {
  buildPromptWithReferences(
    userQuestion: string,
    contents: WebContent[]
  ): string {
    const currentTime = new Date();
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
    const day = String(currentTime.getDate()).padStart(2, '0');
    const hours = String(currentTime.getHours()).padStart(2, '0');
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    const seconds = String(currentTime.getSeconds()).padStart(2, '0');
    const formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;

    console.log(`[PromptBuilder] Current time: ${formattedTime}`);

    const formattedReferences = this.formatReferences(contents);

    const referencesText = formattedReferences
      .map(ref => {
        return `[${ref.number}] Title: ${ref.title}\nURL: ${ref.url}\nContent:\n${ref.content}\n`;
      })
      .join('\n---\n\n');

    const prompt = `Please answer the question based on the reference materials

## Current Time:
${formattedTime}

Please use this as the reference time when answering time-sensitive questions (e.g., "today", "this week", "recently", "latest"). The search results were fetched at this time, so they contain the most up-to-date information available. When answering, prioritize reference materials with timestamps or dates closest to the current time.

## Citation Rules:
- Please cite the context at the end of sentences when appropriate.
- Please use the format of citation number [number] to reference the context in corresponding parts of your answer.
- If a sentence comes from multiple contexts, please list all relevant citation numbers, e.g., [1][2]. Remember not to group citations at the end but list them in the corresponding parts of your answer.
- If all reference content is not relevant to the user's question, please answer based on your knowledge.

## My question is:

${userQuestion}

## Reference Materials:

${referencesText}

Please respond in the same language as the user's question.`;

    return prompt;
  }

  private formatReferences(contents: WebContent[]): FormattedReference[] {
    return contents.map((content, index) => ({
      number: index + 1,
      title: content.title,
      url: content.url,
      content: content.content,
    }));
  }

  extractUrlMapping(contents: WebContent[]): Map<number, string> {
    const mapping = new Map<number, string>();
    contents.forEach((content, index) => {
      mapping.set(index + 1, content.url);
    });
    return mapping;
  }
}

export const promptBuilderService = new PromptBuilderService();
