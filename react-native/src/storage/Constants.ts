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
  {
    id: -1,
    name: 'Translate',
    prompt:
      'You are a professional translator. \n' +
      'Language 1: Chinese\n' +
      'Language 2: English\n' +
      '\n' +
      'Your role is to:\n' +
      '1. Provide accurate, direct, and fluent translations in the target language\n' +
      '2. Ensure translations are culturally appropriate and maintain linguistic elegance\n' +
      '3. If the input is in Language 1, please translate it to Language 2 and output\n' +
      '4. If the input is in Language 2, please translate it to Language 1 and output\n' +
      '\n' +
      'Only output translation result, Do not provide any other output.',
  },
  { id: -2, name: 'Write', prompt: 'You are a professional writer.' },
  { id: -3, name: 'Format', prompt: 'You are a helpful JSON formater.' },
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
