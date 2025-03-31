import { IMessage } from 'react-native-gifted-chat';
import { User } from 'react-native-gifted-chat/lib/Models';

export type Chat = {
  id: number;
  title: string;
  mode: string;
  timestamp: number;
};

export enum ChatStatus {
  Init = 'Init',
  Running = 'Running',
  Complete = 'Complete',
}

export interface EventData {
  id?: number;
  prompt?: SystemPrompt;
}

export type Model = {
  modelId: string;
  modelName: string;
  modelTag?: string;
};

export enum ModelTag {
  Bedrock = 'Bedrock',
  OpenAI = 'OpenAI',
  OpenAICompatible = 'OpenAICompatible',
  DeepSeek = 'DeepSeek',
  Ollama = 'Ollama',
}

export type OllamaModel = {
  name: string;
};

export type AllModel = {
  textModel: Model[];
  imageModel: Model[];
};

export enum ChatMode {
  Text = 'Text',
  Image = 'Image',
}

export type ImageRes = {
  image: string;
  error: string;
};

export enum PressMode {
  Click = 'Click',
  LongPress = 'LongPress',
}

export interface DropdownItem {
  label: string;
  value: string;
}

export type UpgradeInfo = {
  needUpgrade: boolean;
  version: string;
  url: string;
};

export enum FileType {
  document = 'document',
  image = 'image',
  video = 'video',
  unSupported = 'unSupported',
}

export type FileInfo = {
  fileName: string;
  url: string;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  fileSize: number;
  format: string;
  type: FileType;
  width?: number;
  height?: number;
};

export type Usage = {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  imageCount?: number;
  smallImageCount?: number;
  largeImageCount?: number;
};

export type UsagePrice = {
  modelName: string;
  inputPrice: number;
  outputPrice: number;
  totalPrice: number;
  smallImagePrice: number;
  mediumImagePrice: number;
  largeImagePrice: number;
};

export interface SwiftChatMessage extends IMessage {
  usage?: Usage;
  reasoning?: string;
  user: SwiftChatUser;
}

interface SwiftChatUser extends User {
  modelTag?: string;
}

export interface SystemPrompt {
  id: number;
  name: string;
  prompt: string;
  includeHistory: boolean;
}

export interface BedrockChunk {
  contentBlockDelta: {
    delta: Delta;
  };
  metadata: {
    usage: Usage;
  };
  detail: string;
}

export interface Delta {
  text: string;
  reasoningContent: ReasoningContent;
}

export interface ReasoningContent {
  text: string;
}
