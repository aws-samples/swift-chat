import { BedrockAPIChunk, SystemPrompt, Usage } from '../types/Chat.ts';
import { getApiKey, getRegion, getTextModel } from '../storage/StorageUtils.ts';
import { BedrockMessage } from '../chat/util/BedrockMessageConvertor.ts';

type CallbackFunction = (
  result: string,
  complete: boolean,
  needStop: boolean,
  usage?: Usage,
  reasoning?: string
) => void;

export const invokeBedrockWithAPIKey = async (
  messages: BedrockMessage[],
  _prompt: SystemPrompt | null,
  shouldStop: () => boolean,
  controller: AbortController,
  callback: CallbackFunction
) => {
  const modelId = getTextModel().modelId;
  const bodyObject = {
    messages: messages,
  };
  let completeMessage = '';
  let completeReasoning = '';
  const url = `https://bedrock-runtime.${getRegion()}.amazonaws.com/model/${modelId}/converse-stream`;
  const timeoutId = setTimeout(() => controller.abort(), 60000);
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
          console.log(chunk);
          const bedrockChunk = parseChunk(chunk);
          if (bedrockChunk) {
            if (bedrockChunk.reasoning) {
              completeReasoning += bedrockChunk.reasoning ?? '';
              callback(
                completeMessage,
                false,
                false,
                undefined,
                completeReasoning
              );
            }
            if (bedrockChunk.text) {
              completeMessage += bedrockChunk.text ?? '';
              callback(
                completeMessage,
                false,
                false,
                undefined,
                completeReasoning
              );
            }
            if (bedrockChunk.usage) {
              bedrockChunk.usage.modelName = getTextModel().modelName;
              callback(
                completeMessage,
                false,
                false,
                bedrockChunk.usage,
                completeReasoning
              );
            }
          }
          if (done) {
            callback(
              completeMessage,
              true,
              false,
              undefined,
              completeReasoning
            );
            return;
          }
        } catch (readError) {
          console.log('Error reading stream:', readError);
          if (completeMessage === '') {
            completeMessage = '...';
          }
          callback(completeMessage, true, true, undefined, completeReasoning);
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

function parseChunk(rawChunk: string) {
  if (rawChunk.length > 0) {
    // Split by SSE event boundaries
    const events = rawChunk.split('\n\n');
    if (events.length > 0) {
      let combinedReasoning = '';
      let combinedText = '';
      let lastUsage;
      for (let i = 0; i < events.length; i++) {
        const part = events[i];
        if (part.length === 0) {
          continue;
        }
        try {
          const chunk: BedrockAPIChunk = JSON.parse(part);
          const content = extractChunkContent(chunk, rawChunk);
          if (content.reasoning) {
            combinedReasoning += content.reasoning;
          }
          if (content.text) {
            combinedText += content.text;
          }
          if (content.usage) {
            lastUsage = content.usage;
          }
        } catch (innerError) {
          console.log('DataChunk parse error:' + innerError, rawChunk, events);
          return {
            reasoning: combinedReasoning,
            text: rawChunk,
            usage: lastUsage,
          };
        }
      }
      return {
        reasoning: combinedReasoning,
        text: combinedText,
        usage: lastUsage,
      };
    }
  }
  return null;
}

function extractChunkContent(bedrockChunk: BedrockAPIChunk, rawChunk: string) {
  const reasoning = bedrockChunk?.delta?.reasoningContent?.text;
  let text = bedrockChunk?.delta?.text;
  const usage = bedrockChunk?.usage;
  if (bedrockChunk?.Message || bedrockChunk?.message) {
    text = rawChunk;
  }
  return { reasoning, text, usage };
}
