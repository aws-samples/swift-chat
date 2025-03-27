import {
  Model,
  ModelTag,
  OllamaModel,
  SystemPrompt,
  Usage,
} from '../types/Chat.ts';
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
    model: getTextModel().modelId,
    messages: getOllamaMessages(messages, prompt),
  };
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
      let lastChunk = '';
      while (true) {
        if (shouldStop()) {
          await reader.cancel();
          if (completeMessage === '') {
            completeMessage = '...';
          }
          callback(completeMessage, true, true);
          return;
        }

        try {
          const { done, value } = await reader.read();
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) {
            return;
          }
          const parsed = parseStreamData(chunk, lastChunk);
          if (parsed.error) {
            callback(parsed.error, true, true);
            return;
          }
          completeMessage += parsed.content;
          if (parsed.dataChunk) {
            lastChunk = parsed.dataChunk;
          } else {
            lastChunk = '';
          }
          if (parsed.usage && parsed.usage.inputTokens) {
            callback(completeMessage, true, false, parsed.usage);
            return;
          } else {
            callback(completeMessage, done, false);
          }
          if (done) {
            return;
          }
        } catch (readError) {
          console.log('Error reading stream:', readError);
          if (completeMessage === '') {
            completeMessage = '...';
          }
          callback(completeMessage, true, true);
          return;
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

const parseStreamData = (chunk: string, lastChunk: string = '') => {
  let content = '';
  let usage: Usage | undefined;
  const dataChunks = (lastChunk + chunk).split('\n');
  for (let dataChunk of dataChunks) {
    if (!dataChunk.trim()) {
      continue;
    }
    if (dataChunk[0] === '\n') {
      dataChunk = dataChunk.slice(1);
    }
    try {
      const parsedData: OllamaResponse = JSON.parse(dataChunk);

      if (parsedData.message?.content) {
        content += parsedData.message?.content;
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
      if (lastChunk.length > 0) {
        return { error: error + chunk };
      }
      if (content.length > 0) {
        return { content, dataChunk, usage };
      }
    }
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
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    signal: controller.signal,
    reactNative: { textStreaming: true },
  };
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(modelsUrl, options);
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.log(`HTTP error! status: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.models.map((item: OllamaModel) => ({
      modelId: item.name,
      modelName: item.name,
      modelTag: ModelTag.Ollama,
    }));
  } catch (error) {
    clearTimeout(timeoutId);
    console.log('Error fetching models:', error);
    return [];
  }
};
