import { BedrockChunk, SystemPrompt, Usage } from '../types/Chat.ts';
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
          console.log('start read');
          const { done, value } = await reader.read();
          console.log('get value', value);
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
    const events = rawChunk.split(/\n\n|\r\n\r\n/);
    let combinedReasoning = '';
    let combinedText = '';
    let lastUsage;

    for (const event of events) {
      if (!event.trim()) {
        continue;
      }

      try {
        // Parse SSE format: look for data: lines
        const lines = event.split(/\n|\r\n/);
        let messageType = '';
        let dataLine = '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith(':event-type')) {
            // Skip event type parsing
          } else if (trimmedLine.startsWith(':message-type')) {
            messageType = trimmedLine.substring(14).trim();
          } else if (
            trimmedLine.startsWith('event') &&
            trimmedLine.includes('{')
          ) {
            // Extract JSON data from lines like "event{...}"
            const jsonStart = trimmedLine.indexOf('{');
            if (jsonStart !== -1) {
              dataLine = trimmedLine.substring(jsonStart);
            }
          }
        }

        if (dataLine && messageType === 'event') {
          const chunk: BedrockChunk = JSON.parse(dataLine);
          const content = extractChunkContent(chunk, dataLine);

          if (content.reasoning) {
            combinedReasoning += content.reasoning;
          }
          if (content.text) {
            combinedText += content.text;
          }
          if (content.usage) {
            lastUsage = content.usage;
          }
        }
      } catch (innerError) {
        console.log('SSE parse error:', innerError, 'Event:', event);
        // Continue processing other events instead of returning error
        continue;
      }
    }

    if (combinedText || combinedReasoning || lastUsage) {
      return {
        reasoning: combinedReasoning,
        text: combinedText,
        usage: lastUsage,
      };
    }
  }
  return null;
}

function extractChunkContent(bedrockChunk: BedrockChunk, rawChunk: string) {
  const reasoning =
    bedrockChunk?.contentBlockDelta?.delta?.reasoningContent?.text;
  let text = bedrockChunk?.contentBlockDelta?.delta?.text;
  const usage = bedrockChunk?.metadata?.usage;
  if (bedrockChunk?.detail) {
    text = rawChunk;
  }
  return { reasoning, text, usage };
}
