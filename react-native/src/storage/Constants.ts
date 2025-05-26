import { Model, ModelTag, SystemPrompt } from '../types/Chat.ts';
import { getDeepSeekApiKey, getOpenAIApiKey } from './StorageUtils.ts';

// AWS credentials - empty by default, to be filled by user
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
  { modelName: 'GPT-4o', modelId: 'gpt-4o', modelTag: ModelTag.OpenAI },
  {
    modelName: 'GPT-4o mini',
    modelId: 'gpt-4o-mini',
    modelTag: ModelTag.OpenAI,
  },
];

export const DeepSeekModels = [
  {
    modelName: 'DeepSeek-V3',
    modelId: 'deepseek-chat',
    modelTag: ModelTag.DeepSeek,
  },
  {
    modelName: 'DeepSeek-R1',
    modelId: 'deepseek-reasoner',
    modelTag: ModelTag.DeepSeek,
  },
];

export const BedrockThinkingModels = ['Claude 3.7 Sonnet'];
export const BedrockVoiceModels = ['Nova Sonic'];

export const DefaultTextModel = [
  {
    modelName: 'Nova Pro',
    modelId: 'us.amazon.nova-pro-v1:0',
    modelTag: ModelTag.Bedrock,
  },
];

const DefaultImageModel = {
  modelName: 'Stable Diffusion 3.5 Large',
  modelId: 'stability.sd3-5-large-v1:0',
  modelTag: ModelTag.Bedrock,
};

export const VoiceIDList = [
  {
    voiceName: 'Matthew (American English)',
    voiceId: 'matthew',
  },
  {
    voiceName: 'Tiffany (American English)',
    voiceId: 'tiffany',
  },
  {
    voiceName: 'Amy (British English)',
    voiceId: 'amy',
  },
];

export const DefaultVoiceSystemPrompts = [
  {
    id: -4,
    name: 'SentencePractice',
    prompt:
      'Please tell the user that you are their English speaking coach. Your main responsibility is to have the user read common English sentences with you. After the user speaks, first score them from 1-10, with 10 being the best. If the score is below 5, tell the user how to correct their pronunciation and ask them to repeat. If the score is above 5, continue with the next common English phrase. Keep your responses short, usually within five sentences.',
    includeHistory: true,
    promptType: 'voice',
  },
  {
    id: -5,
    name: 'LearningWords',
    prompt:
      'Please inform the user that you are their English speaking coach. Your main responsibility is to have users read common English words with you and tell them the meaning. After they speak, first score them from 1-10, with 10 being the best. If the score is below 5, tell them how to correct their pronunciation and ask them to repeat. If the score is above 5, continue with the next common English word. Keep your responses short, typically within five sentences.',
    includeHistory: true,
    promptType: 'voice',
  },
];

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
  ...DefaultVoiceSystemPrompts,
];

export const DefaultVoicePrompt =
  'You are a friendly assistant. The user and you will engage in a spoken dialog exchanging the transcripts of a natural real-time conversation. Keep your responses short, generally two or three sentences for chatty scenarios.';

export function getAllRegions() {
  return RegionList;
}

export function getDefaultTextModels() {
  return [...DefaultTextModel, ...getDefaultApiKeyModels()] as Model[];
}

export function getDefaultApiKeyModels() {
  return [
    ...(getDeepSeekApiKey().length > 0 ? DeepSeekModels : []),
    ...(getOpenAIApiKey().length > 0 ? GPTModels : []),
  ] as Model[];
}

export function getDefaultImageModels() {
  return [DefaultImageModel] as Model[];
}

export function getDefaultSystemPrompts(): SystemPrompt[] {
  return DefaultSystemPrompts;
}
