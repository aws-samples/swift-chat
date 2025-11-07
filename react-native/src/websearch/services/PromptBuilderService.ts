/**
 * Prompt Builder Service
 * 阶段6: 构建带引用的最终Prompt
 */

import { WebContent } from '../types';

/**
 * 引用格式化后的文本
 */
interface FormattedReference {
  /** 引用编号 */
  number: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 内容 */
  content: string;
}

/**
 * Prompt构建服务
 */
export class PromptBuilderService {
  /**
   * 构建带引用的最终Prompt
   * @param userQuestion 用户原始问题
   * @param contents 网页内容列表
   * @returns 增强后的Prompt
   */
  buildPromptWithReferences(
    userQuestion: string,
    contents: WebContent[]
  ): string {
    console.log('\n========================================');
    console.log('[PromptBuilder] Building enhanced prompt');
    console.log(`[PromptBuilder] Question: ${userQuestion}`);
    console.log(`[PromptBuilder] References: ${contents.length}`);
    console.log('========================================\n');

    // 获取当前系统时间（ISO格式）
    const currentTime = new Date();
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
    const day = String(currentTime.getDate()).padStart(2, '0');
    const hours = String(currentTime.getHours()).padStart(2, '0');
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    const seconds = String(currentTime.getSeconds()).padStart(2, '0');
    const formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;

    console.log(`[PromptBuilder] Current time: ${formattedTime}`);

    // 格式化引用材料
    const formattedReferences = this.formatReferences(contents);

    // 构建引用文本
    const referencesText = formattedReferences
      .map(ref => {
        return `[${ref.number}] Title: ${ref.title}\nURL: ${ref.url}\nContent:\n${ref.content}\n`;
      })
      .join('\n---\n\n');

    // 使用与cherry-studio类似的REFERENCE_PROMPT格式，添加当前时间信息
    const prompt = `Please answer the question based on the reference materials

## Current Time:
${formattedTime}

Please use this as the reference time when answering time-sensitive questions (e.g., "today", "this week", "recently", "latest"). The search results were fetched at this time, so they contain the most up-to-date information available.

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

    console.log('[PromptBuilder] ✓ Prompt built successfully');
    console.log(`[PromptBuilder] Total prompt length: ${prompt.length} chars\n`);

    return prompt;
  }

  /**
   * 格式化引用材料，添加编号
   */
  private formatReferences(contents: WebContent[]): FormattedReference[] {
    return contents.map((content, index) => ({
      number: index + 1,
      title: content.title,
      url: content.url,
      content: content.content,
    }));
  }

  /**
   * 从引用列表中提取URL映射（用于后续的citation处理）
   */
  extractUrlMapping(contents: WebContent[]): Map<number, string> {
    const mapping = new Map<number, string>();
    contents.forEach((content, index) => {
      mapping.set(index + 1, content.url);
    });
    return mapping;
  }
}

/**
 * 单例实例
 */
export const promptBuilderService = new PromptBuilderService();
