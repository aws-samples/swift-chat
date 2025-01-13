import {
  AllModel,
  ChatMode,
  ImageRes,
  SystemPrompt,
  UpgradeInfo,
  Usage,
} from '../types/Chat.ts';
import {
  getApiKey,
  getApiUrl,
  getImageModel,
  getImageSize,
  getRegion,
  getTextModel,
} from '../storage/StorageUtils.ts';
import { saveImageToLocal } from '../chat/util/FileUtils.ts';
import {
  BedrockMessage,
  ImageContent,
  ImageInfo,
  TextContent,
} from '../chat/util/BedrockMessageConvertor.ts';

type CallbackFunction = (
  result: string,
  complete: boolean,
  needStop: boolean,
  usage?: Usage
) => void;
const isDev = false;
const USAGE_START = '\n{"inputTokens":';
export const invokeBedrockWithCallBack = async (
  messages: BedrockMessage[],
  chatMode: ChatMode,
  prompt: SystemPrompt | null,
  shouldStop: () => boolean,
  controller: AbortController,
  callback: CallbackFunction
) => {
  if (!isConfigured()) {
    callback('Please configure your API URL and API Key', true, true);
    return;
  }
  if (chatMode === ChatMode.Text) {
    const bodyObject = {
      messages: messages,
      modelId: getTextModel().modelId,
      region: getRegion(),
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
    const url = getApiPrefix() + '/converse';
    let intervalId: ReturnType<typeof setInterval>;
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
          if (
            chunk[chunk.length - 1] === '}' &&
            chunk.includes('\n') &&
            chunk.indexOf(USAGE_START) !== -1
          ) {
            const index = chunk.indexOf(USAGE_START);
            let usage: Usage;
            if (index > 0) {
              usage = JSON.parse(chunk.slice(index + 1));
              completeMessage += chunk.substring(0, index);
              callback(completeMessage, false, false);
            } else {
              usage = JSON.parse(chunk.slice(1));
            }
            usage.modelName = getTextModel().modelName;
            callback(completeMessage, false, false, usage);
          } else {
            completeMessage += chunk;
            callback(completeMessage, done, false);
          }
          if (done) {
            break;
          }
        }
      })
      .catch(error => {
        clearInterval(intervalId);
        if (shouldStop()) {
          if (completeMessage === '') {
            completeMessage = '...';
          }
          callback(completeMessage, true, true);
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

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      console.log(`HTTP error! status: ${response.status}`);
      return { imageModel: [], textModel: [] };
    }
    return await response.json();
  } catch (error) {
    console.log('Error fetching models:', error);
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

function getApiPrefix(): string {
  if (isDev) {
    return 'http://localhost:8080/api';
  } else {
    return getApiUrl() + '/api';
  }
}

function isConfigured(): boolean {
  return getApiPrefix().startsWith('http') && getApiKey().length > 0;
}
