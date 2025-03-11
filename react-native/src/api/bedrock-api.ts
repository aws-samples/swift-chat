import {
  AllModel,
  BedrockChunk,
  ChatMode,
  ImageRes,
  SystemPrompt,
  UpgradeInfo,
  Usage,
} from '../types/Chat.ts';
import {
  getApiKey,
  getApiUrl,
  getDeepSeekApiKey,
  getImageModel,
  getImageSize,
  getOpenAIApiKey,
  getRegion,
  getTextModel,
  getThinkingEnabled,
} from '../storage/StorageUtils.ts';
import { saveImageToLocal } from '../chat/util/FileUtils.ts';
import {
  BedrockMessage,
  ImageContent,
  ImageInfo,
  TextContent,
} from '../chat/util/BedrockMessageConvertor.ts';
import { invokeOpenAIWithCallBack } from './open-api.ts';
import { invokeOllamaWithCallBack } from './ollama-api.ts';
import { BedrockThinkingModels, DeepSeekModels } from '../storage/Constants.ts';

type CallbackFunction = (
  result: string,
  complete: boolean,
  needStop: boolean,
  usage?: Usage,
  reasoning?: string
) => void;
export const isDev = false;
export const invokeBedrockWithCallBack = async (
  messages: BedrockMessage[],
  chatMode: ChatMode,
  prompt: SystemPrompt | null,
  shouldStop: () => boolean,
  controller: AbortController,
  callback: CallbackFunction
) => {
  const isDeepSeek = DeepSeekModels.some(
    model => model.modelId === getTextModel().modelId
  );
  const isOpenAI = getTextModel().modelId.includes('gpt');
  const isOllama = getTextModel().modelId.startsWith('ollama-');
  if (chatMode === ChatMode.Text && (isDeepSeek || isOpenAI || isOllama)) {
    if (isDeepSeek && getDeepSeekApiKey().length === 0) {
      callback('Please configure your DeepSeek API Key', true, true);
      return;
    }
    if (isOpenAI && getOpenAIApiKey().length === 0) {
      callback('Please configure your OpenAI API Key', true, true);
      return;
    }
    if (isOllama) {
      await invokeOllamaWithCallBack(
        messages,
        prompt,
        shouldStop,
        controller,
        callback
      );
    } else {
      await invokeOpenAIWithCallBack(
        messages,
        prompt,
        shouldStop,
        controller,
        callback
      );
    }
    return;
  }
  if (!isConfigured()) {
    callback('Please configure your API URL and API Key', true, true);
    return;
  }
  if (chatMode === ChatMode.Text) {
    const bodyObject = {
      messages: messages,
      modelId: getTextModel().modelId,
      region: getRegion(),
      enableThinking: isEnableThinking(),
      system: prompt ? [{ text: prompt?.prompt }] : undefined,
    };
    if (prompt?.includeHistory === false) {
      bodyObject.messages = messages.slice(-1);
    }

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
    const url = getApiPrefix() + '/converse/v2';
    let completeMessage = '';
    let completeReasoning = '';
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
        let appendTimes = 0;
        while (true) {
          if (shouldStop()) {
            await reader.cancel();
            if (completeMessage === '') {
              completeMessage = '...';
            }
            callback(completeMessage, true, true, undefined, completeReasoning);
            return;
          }

          try {
            const { done, value } = await reader.read();
            const chunk = decoder.decode(value, { stream: true });
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
                appendTimes++;
                if (appendTimes > 5000 && appendTimes % 2 === 0) {
                  continue;
                }
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
        clearTimeout(timeoutId);
        if (shouldStop()) {
          if (completeMessage === '') {
            completeMessage = '...';
          }
          callback(completeMessage, true, true, undefined, completeReasoning);
        } else {
          let errorMsg = String(error);
          if (errorMsg.endsWith('AbortError: Aborted')) {
            errorMsg = 'Timed out';
          }
          if (errorMsg.indexOf('http') >= 0) {
            errorMsg = 'Unable to resolve host';
          }
          const errorInfo = 'Request error: ' + errorMsg;
          callback(completeMessage + '\n\n' + errorInfo, true, true);
          console.log(errorInfo);
        }
      });
  } else {
    const imagePrompt = (
      messages[messages.length - 1].content[0] as TextContent
    ).text;
    let image: ImageInfo | undefined;
    if (messages[messages.length - 1].content[1]) {
      image = (messages[messages.length - 1].content[1] as ImageContent).image;
    }

    const imageRes = await genImage(imagePrompt, controller, image);
    if (imageRes.image.length > 0) {
      const localFilePath = await saveImageToLocal(imageRes.image);
      const imageSize = getImageSize().split('x')[0].trim();
      const usage: Usage = {
        modelName: getImageModel().modelName,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        smallImageCount: 0,
        imageCount: 0,
        largeImageCount: 0,
      };
      if (imageSize === '512') {
        usage.smallImageCount = 1;
      } else if (imageSize === '1024') {
        usage.imageCount = 1;
      } else if (imageSize === '2048') {
        usage.largeImageCount = 1;
      }
      if (localFilePath) {
        callback(`![](${localFilePath})`, true, false, usage);
      }
    } else {
      if (imageRes.error.endsWith('AbortError: Aborted')) {
        if (shouldStop()) {
          imageRes.error = 'Request canceled';
        } else {
          imageRes.error = 'Request timed out';
        }
      }
      if (imageRes.error.indexOf('http') >= 0) {
        imageRes.error = 'Request error: Unable to resolve host';
      }
      callback(imageRes.error, true, true);
    }
  }
};

export const requestAllModels = async (): Promise<AllModel> => {
  const controller = new AbortController();
  const url = getApiPrefix() + '/models';
  const bodyObject = {
    region: getRegion(),
  };
  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: 'Bearer ' + getApiKey(),
    },
    body: JSON.stringify(bodyObject),
    reactNative: { textStreaming: true },
  };
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.log(`HTTP error! status: ${response.status}`);
      return { imageModel: [], textModel: [] };
    }
    return await response.json();
  } catch (error) {
    console.log('Error fetching models:', error);
    clearTimeout(timeoutId);
    return { imageModel: [], textModel: [] };
  }
};

export const requestUpgradeInfo = async (
  os: string,
  version: string
): Promise<UpgradeInfo> => {
  const url = getApiPrefix() + '/upgrade';
  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: 'Bearer ' + getApiKey(),
    },
    body: JSON.stringify({
      os: os,
      version: version,
    }),
    reactNative: { textStreaming: true },
  };

  try {
    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    console.log('Error fetching upgrade info:', error);
    return { needUpgrade: false, version: '', url: '' };
  }
};

export const genImage = async (
  imagePrompt: string,
  controller: AbortController,
  image?: ImageInfo
): Promise<ImageRes> => {
  if (!isConfigured()) {
    return {
      image: '',
      error: 'Please configure your API URL and API Key',
    };
  }
  const url = getApiPrefix() + '/image';
  const imageSize = getImageSize().split('x');
  const width = imageSize[0].trim();
  const height = imageSize[1].trim();
  const bodyObject = {
    prompt: imagePrompt,
    refImages: image ? [image] : undefined,
    modelId: getImageModel().modelId,
    region: getRegion(),
    width: width,
    height: height,
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

  try {
    const timeoutMs = parseInt(width, 10) >= 1024 ? 120000 : 90000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, options);
    if (!response.ok) {
      const errMsg = `HTTP error! status: ${response.status}`;
      console.log(errMsg);
      return {
        image: '',
        error: errMsg,
      };
    }
    const data = await response.json();
    clearTimeout(timeoutId);
    if (data.error) {
      console.log(data.error);
      return {
        image: '',
        error: data.error,
      };
    }
    if (data.image && data.image.length > 0) {
      return {
        image: data.image,
        error: '',
      };
    }
    return {
      image: '',
      error: 'image is empty',
    };
  } catch (error) {
    const errMsg = `Error fetching image: ${error}`;
    console.log(errMsg);
    return {
      image: '',
      error: errMsg,
    };
  }
};

function parseChunk(rawChunk: string) {
  if (rawChunk.length > 0) {
    try {
      const bedrockChunk: BedrockChunk = JSON.parse(rawChunk);
      return extractChunkContent(bedrockChunk, rawChunk);
    } catch (error) {
      if (rawChunk.indexOf('}{') > 0) {
        const jsonParts = rawChunk.split('}{');
        let combinedReasoning = '';
        let combinedText = '';
        let lastUsage;
        for (let i = 0; i < jsonParts.length; i++) {
          let part = jsonParts[i];
          part =
            (i >= 1 ? '{' : '') + part + (i < jsonParts.length - 1 ? '}' : '');
          try {
            const chunk: BedrockChunk = JSON.parse(part);
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
            console.log('Error parsing split JSON part: ' + innerError);
          }
        }
        return {
          reasoning: combinedReasoning,
          text: combinedText,
          usage: lastUsage,
        };
      } else {
        // return and display the raw error
        console.log('Unexpected raw chunk: ' + rawChunk);
        return {
          reasoning: undefined,
          text: rawChunk,
          usage: undefined,
        };
      }
    }
  }
  return null;
}

/**
 * Helper function to extract content from a BedrockChunk
 */
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

function getApiPrefix(): string {
  if (isDev) {
    return 'http://localhost:8080/api';
  } else {
    return getApiUrl() + '/api';
  }
}

const isEnableThinking = (): boolean => {
  return isThinkingModel() && getThinkingEnabled();
};

const isThinkingModel = (): boolean => {
  const textModelName = getTextModel().modelName;
  return BedrockThinkingModels.includes(textModelName);
};

function isConfigured(): boolean {
  return getApiPrefix().startsWith('http') && getApiKey().length > 0;
}
