import { IMessage } from 'react-native-gifted-chat';

export type Chat = {
  id: number;
  title: string;
  mode: string;
  timestamp: number;
  token: number[];
};

export enum ChatStatus {
  Init = 'Init',
  Running = 'Running',
  Complete = 'Complete',
}

export interface EventData {
  id: number;
}

export type Model = {
  modelId: string;
  modelName: string;
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
};

export interface IMessageWithToken extends IMessage {
  usage?: Usage;
}
