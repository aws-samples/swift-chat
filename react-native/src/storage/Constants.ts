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

export const GPTModels = [
  { modelName: 'GPT-4o', modelId: 'gpt-4o' },
  { modelName: 'GPT-4o mini', modelId: 'gpt-4o-mini' },
];

export const DeepSeekModels = [
  { modelName: 'DeepSeek-V3', modelId: 'deepseek-chat' },
  { modelName: 'DeepSeek-R1', modelId: 'deepseek-reasoner' },
];

export const BedrockThinkingModels = ['Claude 3.7 Sonnet'];

const DefaultTextModel = [
  {
    modelName: 'Nova Pro',
    modelId: 'us.amazon.nova-pro-v1:0',
  },
  ...DeepSeekModels,
  ...GPTModels,
];

const DefaultImageModel = {
  modelName: 'Stable Diffusion 3.5 Large',
  modelId: 'stability.sd3-5-large-v1:0',
};

const DefaultSystemPrompts = [
  {
    id: -1,
    name: 'Translate',
    prompt: `You are a professional translator specialized in Chinese-English translation.
If the user input is in Chinese, please translate it into English; if the user input is in English, please translate it into Chinese. 
Return single best translation only.
No explanation or alternatives.`,
    includeHistory: false,
  },
  {
    id: -2,
    name: 'OptimizeCode',
    prompt: `You are a code optimizer that focuses on identifying 1-3 key improvements in code snippets while maintaining core functionality. Analyze performance, readability and modern best practices.

If no code is provided: Reply "Please share code for optimization."
If code needs improvement: Provide optimized version with 1-3 specific changes and their benefits.
If code is already optimal: Reply "Code is well written, no significant optimizations needed."

Stay focused on practical improvements only.`,
    includeHistory: false,
  },
  {
    id: -3,
    name: 'CreateStory',
    prompt:
      'You are an AI assistant with a passion for creative writing and storytelling. Your task is to collaborate with users to create engaging stories, offering imaginative plot twists and dynamic character development. Encourage the user to contribute their ideas and build upon them to create a captivating narrative.',
    includeHistory: true,
  },
];

export function getAllRegions() {
  return RegionList;
}

export function getDefaultTextModels() {
  return DefaultTextModel as Model[];
}

export function getDefaultImageModels() {
  return [DefaultImageModel] as Model[];
}

export function getDefaultSystemPrompts(): SystemPrompt[] {
  return DefaultSystemPrompts;
}
