import { Model, SystemPrompt } from '../types/Chat.ts';

const RegionList = [
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

export const DefaultRegion = 'us-west-2';

const DefaultTextModel = {
  modelName: 'Nova Pro',
  modelId: 'us.amazon.nova-pro-v1:0',
};

const DefaultImageModel = {
  modelName: 'Stable Diffusion 3.5 Large',
  modelId: 'stability.sd3-5-large-v1:0',
};

const DefaultSystemPrompts = [
  { name: 'Translate', prompt: 'You are a professional translator.' },
  { name: 'Write', prompt: 'You are a professional writer.' },
  { name: 'Format', prompt: 'You are a helpful JSON formater.' },
];

export function getAllRegions() {
  return RegionList;
}

export function getDefaultTextModels() {
  return [DefaultTextModel] as Model[];
}

export function getDefaultImageModels() {
  return [DefaultImageModel] as Model[];
}

export function getDefaultSystemPrompts(): SystemPrompt[] {
  return DefaultSystemPrompts;
}
