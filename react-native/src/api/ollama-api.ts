import { Model, OllamaModel, SystemPrompt, Usage } from '../types/Chat.ts';
import { getOllamaApiUrl, getTextModel } from '../storage/StorageUtils.ts';
import {
  BedrockMessage,
  ImageContent,
  OpenAIMessage,
  TextContent,
} from '../chat/util/BedrockMessageConvertor.ts';

type CallbackFunction = (
  result: string,
  complete: boolean,
  needStop: boolean,
  usage?: Usage
) => void;
export const invokeOllamaWithCallBack = async (
  messages: BedrockMessage[],
  prompt: SystemPrompt | null,
  shouldStop: () => boolean,
  controller: AbortController,
  callback: CallbackFunction
) => {
  const bodyObject = {
    model: getTextModel().modelId.split('ollama-')[1],
    messages: getOllamaMessages(messages, prompt),
  };
  console.log(JSON.stringify(bodyObject, null, 2));
  const options = {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
    },
    body: JSON.stringify(bodyObject),
    signal: controller.signal,
    reactNative: { textStreaming: true },
  };
  const url = getOllamaApiUrl() + '/api/chat';
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
      while (true) {
        const { done, value } = await reader.read();
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) {
          break;
        }
        const parsed = parseStreamData(chunk);
        if (parsed.error) {
          callback(parsed.error, true, true);
          break;
        }
        completeMessage += parsed.content;
        if (parsed.usage && parsed.usage.inputTokens) {
          callback(completeMessage, true, false, parsed.usage);
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
      clearTimeout(timeoutId);
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

const parseStreamData = (chunk: string) => {
  let content = '';
  let usage: Usage | undefined;

  try {
    const parsedData: OllamaResponse = JSON.parse(chunk);

    if (parsedData.message?.content) {
      content = parsedData.message?.content;
    }

    if (parsedData.done) {
      usage = {
        modelName: getTextModel().modelName,
        inputTokens: parsedData.prompt_eval_count,
        outputTokens: parsedData.eval_count,
        totalTokens: parsedData.prompt_eval_count + parsedData.eval_count,
      };
    }
  } catch (error) {
    console.info('parse error:', error, chunk);
    return { error: chunk };
  }
  return { content, usage };
};

type OllamaResponse = {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  prompt_eval_count: number;
  eval_count: number;
};

function getOllamaMessages(
  messages: BedrockMessage[],
  prompt: SystemPrompt | null
): OpenAIMessage[] {
  return [
    ...(prompt ? [{ role: 'system', content: prompt.prompt }] : []),
    ...messages.map(message => {
      const images = message.content
        .filter(content => (content as ImageContent).image)
        .map(content => (content as ImageContent).image.source.bytes);

      return {
        role: message.role,
        content: message.content
          .map(content => {
            if ((content as TextContent).text) {
              return (content as TextContent).text;
            }
            return '';
          })
          .join('\n'),
        images: images.length > 0 ? images : undefined,
      };
    }),
  ];
}

export const requestAllOllamaModels = async (): Promise<Model[]> => {
  const controller = new AbortController();
  const modelsUrl = getOllamaApiUrl() + '/api/tags';
  console.log(modelsUrl);
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    signal: controller.signal,
    reactNative: { textStreaming: true },
  };
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(modelsUrl, options);
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.log(`HTTP error! status: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.models.map((item: OllamaModel) => ({
      modelId: 'ollama-' + item.name,
      modelName: item.name,
    }));
  } catch (error) {
    clearTimeout(timeoutId);
    console.log('Error fetching models:', error);
    return [];
  }
};
