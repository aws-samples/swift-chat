import { IMessage } from 'react-native-gifted-chat';
import { MMKV } from 'react-native-mmkv';
import {
  AllModel,
  Chat,
  ChatMode,
  IMessageWithToken,
  Model,
  Usage,
} from '../types/Chat.ts';
import uuid from 'uuid';

export const storage = new MMKV();

const initializeStorage = () => {
  const key = 'encryption_key';
  let encryptionKey = storage.getString(key);
  if (!encryptionKey) {
    encryptionKey = uuid.v4();
    storage.set(key, encryptionKey);
  }

  return new MMKV({
    id: 'swiftchat',
    encryptionKey: encryptionKey,
  });
};
export const encryptStorage = initializeStorage();

const keyPrefix = 'bedrock/';
const messageListKey = keyPrefix + 'messageList';
const sessionIdPrefix = keyPrefix + 'sessionId/';
const currentSessionIdKey = keyPrefix + 'currentSessionId';
const hapticEnabledKey = keyPrefix + 'hapticEnabled';
const apiUrlKey = keyPrefix + 'apiUrlKey';
const apiKeyTag = keyPrefix + 'apiKeyTag';
const regionKey = keyPrefix + 'regionKey';
const textModelKey = keyPrefix + 'textModelKey';
const imageModelKey = keyPrefix + 'imageModelKey';
const allModelKey = keyPrefix + 'allModelKey';
const imageSizeKey = keyPrefix + 'imageSizeKey';
const modelUsageKey = keyPrefix + 'modelUsageKey';

let currentApiUrl: string | undefined;
let currentApiKey: string | undefined;
let currentRegion: string | undefined;
let currentImageModel: Model | undefined;
let currentTextModel: Model | undefined;

export function saveMessages(
  sessionId: number,
  messages: IMessage[],
  usage: Usage
) {
  (messages[0] as IMessageWithToken).usage = usage;
  storage.set(sessionIdPrefix + sessionId, JSON.stringify(messages));
}

export function saveMessageList(
  sessionId: number,
  fistMessage: IMessage,
  chatMode: ChatMode
) {
  let allMessageStr = getMessageListStr();
  const currentMessageStr = JSON.stringify({
    id: sessionId,
    title: fistMessage.text.substring(0, 50).replaceAll('\n', ' '),
    mode: chatMode.toString(),
    timestamp: (fistMessage.createdAt as Date).getTime(),
  });
  if (allMessageStr.length === 1) {
    allMessageStr = currentMessageStr + allMessageStr;
  } else {
    allMessageStr = currentMessageStr + ',' + allMessageStr;
  }
  storage.set(messageListKey, allMessageStr);
  storage.set(currentSessionIdKey, sessionId);
}

export function getMessageList(): Chat[] {
  return JSON.parse('[' + getMessageListStr()) as Chat[];
}

export function updateMessageList(chatList: Chat[]) {
  if (chatList.length > 0) {
    storage.set(messageListKey, JSON.stringify(chatList).substring(1));
  } else {
    storage.delete(messageListKey);
  }
}

function getMessageListStr() {
  return storage.getString(messageListKey) ?? ']';
}

export function getMessagesBySessionId(sessionId: number): IMessage[] {
  const messageStr = storage.getString(sessionIdPrefix + sessionId);
  if (messageStr) {
    return JSON.parse(messageStr) as IMessage[];
  }
  return [];
}

export function deleteMessagesBySessionId(sessionId: number) {
  storage.delete(sessionIdPrefix + sessionId);
}

export function getSessionId() {
  return storage.getNumber(currentSessionIdKey) ?? 0;
}

export function saveKeys(apiUrl: string, apiKey: string) {
  if (apiUrl.endsWith('/')) {
    apiUrl = apiUrl.slice(0, -1);
  }
  saveApiUrl(apiUrl);
  saveApiKey(apiKey);
  currentApiKey = apiKey;
  currentApiUrl = apiUrl;
}

export function getApiUrl(): string {
  if (currentApiUrl) {
    return currentApiUrl;
  } else {
    currentApiUrl = storage.getString(apiUrlKey) ?? '';
    return currentApiUrl;
  }
}

export function getApiKey(): string {
  if (currentApiKey) {
    return currentApiKey;
  } else {
    currentApiKey = encryptStorage.getString(apiKeyTag) ?? '';
    return currentApiKey;
  }
}

export function saveHapticEnabled(enabled: boolean) {
  storage.set(hapticEnabledKey, enabled);
}

export function getHapticEnabled() {
  return storage.getBoolean(hapticEnabledKey) ?? true;
}

export function saveApiUrl(apiUrl: string) {
  storage.set(apiUrlKey, apiUrl);
}

export function saveApiKey(apiKey: string) {
  encryptStorage.set(apiKeyTag, apiKey);
}

export function saveRegion(region: string) {
  currentRegion = region;
  storage.set(regionKey, region);
}

export function getRegion() {
  if (currentRegion) {
    return currentRegion;
  } else {
    currentRegion = storage.getString(regionKey) ?? 'us-west-2';
    return currentRegion;
  }
}

export function saveTextModel(model: Model) {
  currentTextModel = model;
  storage.set(textModelKey, JSON.stringify(model));
}

export function getTextModel(): Model {
  if (currentTextModel) {
    return currentTextModel;
  } else {
    const modelString = storage.getString(textModelKey) ?? '';
    if (modelString.length > 0) {
      currentTextModel = JSON.parse(modelString) as Model;
    } else {
      currentTextModel = getDefaultTextModels()[0];
    }
    return currentTextModel;
  }
}

export function getDefaultTextModels() {
  return [
    {
      modelName: 'Claude 3.5 Sonnet',
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    },
  ] as Model[];
}

export function getDefaultImageModels() {
  return [
    {
      modelName: 'Stable Image Core 1.0',
      modelId: 'stability.stable-image-core-v1:0',
    },
  ] as Model[];
}

export function saveImageModel(model: Model) {
  currentImageModel = model;
  storage.set(imageModelKey, JSON.stringify(model));
}

export function getImageModel(): Model {
  if (currentImageModel) {
    return currentImageModel;
  } else {
    const modelString = storage.getString(imageModelKey) ?? '';
    if (modelString.length > 0) {
      currentImageModel = JSON.parse(modelString) as Model;
    } else {
      currentImageModel = getDefaultImageModels()[0];
    }
    return currentImageModel;
  }
}

export function saveAllModels(allModels: AllModel) {
  storage.set(allModelKey, JSON.stringify(allModels));
}

export function getAllModels() {
  const modelString = storage.getString(allModelKey) ?? '';
  if (modelString.length > 0) {
    return JSON.parse(modelString) as AllModel;
  }
  return {
    imageModel: getDefaultImageModels(),
    textModel: getDefaultTextModels(),
  };
}

export function getAllRegions() {
  return [
    'us-west-2',
    'us-east-1',
    'ap-south-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ca-central-1',
    'eu-central-1',
    'eu-west-2',
    'eu-west-3',
    'sa-east-1',
  ];
}

export function getAllImageSize(imageModelId: string = '') {
  if (isNewStabilityImageModel(imageModelId)) {
    return ['1024 x 1024'];
  }
  if (isNovaCanvas(imageModelId)) {
    return ['1024 x 1024', '2048 x 2048'];
  }
  return ['512 x 512', '1024 x 1024'];
}

export function isNewStabilityImageModel(modelId: string) {
  return (
    modelId === 'stability.sd3-large-v1:0' ||
    modelId === 'stability.stable-image-ultra-v1:0' ||
    modelId === 'stability.stable-image-core-v1:0'
  );
}

export function isNovaCanvas(modelId: string) {
  return modelId.includes('nova-canvas');
}

export function saveImageSize(size: string) {
  storage.set(imageSizeKey, size);
}

export function getImageSize() {
  return storage.getString(imageSizeKey) ?? getAllImageSize()[1];
}

export function getModelUsage(): Usage[] {
  const usage = storage.getString(modelUsageKey);
  return usage ? JSON.parse(usage) : [];
}

export function updateTotalUsage(usage: Usage) {
  const currentUsage = getModelUsage();
  const modelIndex = currentUsage.findIndex(
    m => m.modelName === usage.modelName
  );
  if (modelIndex >= 0) {
    if (usage.imageCount) {
      currentUsage[modelIndex].imageCount! += usage.imageCount;
    } else if (usage.smallImageCount) {
      currentUsage[modelIndex].smallImageCount! += usage.smallImageCount;
    } else if (usage.largeImageCount) {
      currentUsage[modelIndex].largeImageCount! += usage.largeImageCount;
    } else {
      currentUsage[modelIndex].inputTokens += usage.inputTokens;
      currentUsage[modelIndex].outputTokens += usage.outputTokens;
    }
  } else {
    currentUsage.push(usage);
  }
  storage.set(modelUsageKey, JSON.stringify(currentUsage));
}
