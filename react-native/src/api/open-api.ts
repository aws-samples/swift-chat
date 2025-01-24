import { SystemPrompt, Usage } from '../types/Chat.ts';
import {
  getApiUrl,
  getDeepSeekApiKey,
  getOpenAIApiKey,
  getOpenAIProxyEnabled,
  getTextModel,
} from '../storage/StorageUtils.ts';
import {
  BedrockMessage,
  DocumentContent,
  ImageContent,
  OpenAIMessage,
  TextContent,
} from '../chat/util/BedrockMessageConvertor.ts';
import { isDev } from './bedrock-api.ts';
import { GITHUB_LINK } from '../settings/SettingsScreen.tsx';

type CallbackFunction = (
  result: string,
  complete: boolean,
  needStop: boolean,
  usage?: Usage
) => void;
export const invokeOpenAIWithCallBack = async (
  messages: BedrockMessage[],
  prompt: SystemPrompt | null,
  shouldStop: () => boolean,
  controller: AbortController,
  callback: CallbackFunction
) => {
  const bodyObject = {
    model: getTextModel().modelId,
    messages: getOpenAIMessages(messages, prompt),
    stream: true,
    stream_options: {
      include_usage: true,
    },
  };

  const options = {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
      Authorization: 'Bearer ' + getApiKey(),
    },
    body: JSON.stringify(bodyObject),
    signal: controller.signal,
    reactNative: { textStreaming: true },
  };
  const url = getApiURL();
  let completeMessage = '';
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  fetch(url!, options)
    .then(response => {
      return response.body;
    })
    .then(async body => {
      clearTimeout(timeoutId);
      if (!body) {
        return;
      }
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let isFirstReason = true;
      let isFirstContent = true;
      let lastChunk = '';
      while (true) {
        const { done, value } = await reader.read();
        const chunk = decoder.decode(value, { stream: true });
        const parsed = parseStreamData(chunk, lastChunk);
        if (parsed.error) {
          callback(completeMessage + '\n\n' + parsed.error, true, true);
          break;
        }
        if (parsed.reason) {
          const formattedReason = parsed.reason.replace(/\n\n/g, '\n>\n>');
          if (isFirstReason) {
            completeMessage += '> ';
            isFirstReason = false;
          }
          completeMessage += formattedReason;
        }
        if (parsed.content) {
          if (!isFirstReason && isFirstContent) {
            completeMessage += '\n\n';
            isFirstContent = false;
          }
          completeMessage += parsed.content;
        }
        if (parsed.dataChunk) {
          lastChunk = parsed.dataChunk;
        } else {
          lastChunk = '';
        }
        if (parsed.usage && parsed.usage.inputTokens) {
          callback(completeMessage, false, false, parsed.usage);
        } else {
          callback(completeMessage, done, false);
        }
        if (done) {
          break;
        }
      }
    })
    .catch(error => {
      console.log(error);
      if (shouldStop()) {
        if (completeMessage === '') {
          completeMessage = '...';
        }
        callback(completeMessage, true, true);
      } else {
        const errorMsg = String(error);
        const errorInfo = 'Request error: ' + errorMsg;
        callback(completeMessage + '\n\n' + errorInfo, true, true);
      }
    });
};

const parseStreamData = (chunk: string, lastChunk: string = '') => {
  const dataChunks = (lastChunk + chunk).split('\n\n');
  let content = '';
  let reason = '';
  let usage: Usage | undefined;
  for (let dataChunk of dataChunks) {
    if (!dataChunk.trim()) {
      continue;
    }
    if (dataChunk[0] === '\n') {
      dataChunk = dataChunk.slice(1);
    }
    const cleanedData = dataChunk.replace(/^data: /, '');
    if (cleanedData.trim() === '[DONE]') {
      continue;
    }

    try {
      const parsedData: ChatResponse = JSON.parse(cleanedData);
      if (parsedData.error) {
        return { error: parsedData.error.message };
      }
      if (parsedData.detail) {
        return {
          error:
            `Error: Please upgrade your [server API](${GITHUB_LINK}?tab=readme-ov-file#upgrade-api), API ` +
            parsedData.detail,
        };
      }
      if (parsedData.choices[0]?.delta?.content) {
        content += parsedData.choices[0].delta.content;
      }

      if (parsedData.choices[0]?.delta?.reasoning_content) {
        reason += parsedData.choices[0].delta.reasoning_content;
      }

      if (parsedData.usage) {
        usage = {
          modelName: getTextModel().modelName,
          inputTokens:
            parsedData.usage.prompt_tokens -
            (parsedData.usage.prompt_cache_hit_tokens ?? 0),
          outputTokens: parsedData.usage.completion_tokens,
          totalTokens: parsedData.usage.total_tokens,
        };
      }
    } catch (error) {
      if (lastChunk.length > 0) {
        return { error: error + cleanedData };
      }
      if (reason || content) {
        return { reason, content, dataChunk, usage };
      }
    }
  }
  return { reason, content, usage };
};

type ChatResponse = {
  choices: Array<{
    delta: {
      content: string;
      reasoning_content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens: number;
  };
  error?: {
    message: string;
  };
  detail?: string;
};

function getOpenAIMessages(
  messages: BedrockMessage[],
  prompt: SystemPrompt | null
): OpenAIMessage[] {
  return [
    ...(prompt ? [{ role: 'system', content: prompt.prompt }] : []),
    ...messages.map(message => {
      const hasImage = message.content.some(content => 'image' in content);
      if (hasImage) {
        return {
          role: message.role,
          content: message.content.map(content => {
            if ('text' in content) {
              return {
                type: 'text' as const,
                text: (content as TextContent).text,
              };
            } else {
              const base64Data = (content as ImageContent).image.source.bytes;
              return {
                type: 'image_url' as const,
                image_url: {
                  url: `data:image/png;base64,${base64Data}`,
                },
              };
            }
          }),
        };
      }
      const hasDoc = message.content.some(content => 'document' in content);
      if (hasDoc) {
        const text = message.content.find(
          content => 'text' in content
        ) as TextContent;
        const doc = message.content.find(content => 'document' in content);
        const docContent = (doc as DocumentContent).document.source.bytes;
        return {
          role: message.role,
          content: text.text + '\nDocument base64 is:\n ' + docContent,
        };
      }
      return {
        role: message.role,
        content: message.content
          .map(content => (content as TextContent).text)
          .join('\n'),
      };
    }),
  ];
}

function getApiKey(): string {
  if (getTextModel().modelId.includes('deepseek')) {
    return getDeepSeekApiKey();
  } else {
    return getOpenAIApiKey();
  }
}

function getApiURL(): string {
  if (getTextModel().modelId.includes('deepseek')) {
    return 'https://api.deepseek.com/chat/completions';
  } else {
    if (getOpenAIProxyEnabled()) {
      return (isDev ? 'http://localhost:8080' : getApiUrl()) + '/api/gpt';
    } else {
      return 'https://api.openai.com/v1/chat/completions';
    }
  }
}
