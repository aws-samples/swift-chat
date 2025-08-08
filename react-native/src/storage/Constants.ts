import { Model, ModelTag, SystemPrompt } from '../types/Chat.ts';
import { getDeepSeekApiKey, getOpenAIApiKey } from './StorageUtils.ts';

// AWS credentials - empty by default, to be filled by user
const RegionList = [
  'us-west-2',
  'us-east-1',
  'us-east-2',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ca-central-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'sa-east-1',
];

export const DefaultRegion = 'us-west-2';

export const GPTModels = [
  { modelName: 'GPT-5', modelId: 'gpt-5', modelTag: ModelTag.OpenAI },
  {
    modelName: 'GPT-5-chat',
    modelId: 'gpt-5-chat-latest',
    modelTag: ModelTag.OpenAI,
  },
  { modelName: 'GPT-5-mini', modelId: 'gpt-5-mini', modelTag: ModelTag.OpenAI },
  { modelName: 'GPT-5-nano', modelId: 'gpt-5-nano', modelTag: ModelTag.OpenAI },
  { modelName: 'GPT-4.1', modelId: 'gpt-4.1', modelTag: ModelTag.OpenAI },
  {
    modelName: 'GPT-4.1-mini',
    modelId: 'gpt-4.1-mini',
    modelTag: ModelTag.OpenAI,
  },
  {
    modelName: 'GPT-4.1-nano',
    modelId: 'gpt-4.1-nano',
    modelTag: ModelTag.OpenAI,
  },
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

export const BedrockThinkingModels = [
  'Claude 3.7 Sonnet',
  'Claude Sonnet 4',
  'Claude Opus 4',
];
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
  {
    voiceName: 'Ambre (French)',
    voiceId: 'ambre',
  },
  {
    voiceName: 'Florian (French)',
    voiceId: 'florian',
  },
  {
    voiceName: 'Beatrice (Italian)',
    voiceId: 'beatrice',
  },
  {
    voiceName: 'Lorenzo (Italian)',
    voiceId: 'lorenzo',
  },
  {
    voiceName: 'Greta (German)',
    voiceId: 'greta',
  },
  {
    voiceName: 'Lennart (German)',
    voiceId: 'lennart',
  },
  {
    voiceName: 'Lupe (Spanish)',
    voiceId: 'lupe',
  },
  {
    voiceName: 'Carlos (Spanish)',
    voiceId: 'carlos',
  },
];

export const DefaultImageSystemPrompts = [
  {
    id: -7,
    name: 'Virtual try-on',
    prompt: 'Virtual try-on',
    includeHistory: false,
    promptType: 'image',
  },
  {
    id: -8,
    name: 'Variations',
    prompt: 'Generate similar style of the image',
    includeHistory: false,
    promptType: 'image',
  },
  {
    id: -9,
    name: 'RemoveBG',
    prompt: 'Remove background of the image',
    includeHistory: false,
    promptType: 'image',
  },
];

export const DefaultVoiceSystemPrompts = [
  {
    id: -4,
    name: 'LearnWords',
    prompt: `Please act as an English vocabulary coach. In each response, follow this exact format:

1. If the user has spoken: Score their speaking from 1-10
2. If score < 7: Provide brief correction tips and ask them to repeat the same word
3. If score ≥ 7: ask user to read a new English word

Keep all responses under 5 sentences. Begin by introducing yourself and providing the first practice word.

Remember: ALWAYS start with a score after the user speaks`,
    includeHistory: true,
    promptType: 'voice',
    allowInterruption: false,
  },
  {
    id: -5,
    name: 'LearnSentences',
    prompt: `Please act as an English pronunciation coach. In each response, follow this exact format:

1. If the user has spoken: Score their pronunciation from 1-10
2. If score < 7: Provide brief correction tips and ask them to repeat the same sentence
3. If score ≥ 7: Introduce a new common English phrase for practice

Keep all responses under 5 sentences. Begin by introducing yourself and providing the first practice sentence.

Remember: ALWAYS start with a score after the user speaks`,
    includeHistory: true,
    promptType: 'voice',
    allowInterruption: false,
  },
  {
    id: -6,
    name: 'Story',
    prompt:
      'You are a storytelling expert. Please first ask the user what type of story they would like to hear, and then tell that story with emotion and expressiveness.',
    includeHistory: true,
    promptType: 'voice',
    allowInterruption: true,
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
  ...DefaultImageSystemPrompts,
];

export const DefaultVoicePrompt =
  'You are a friendly assistant. The user and you will engage in a spoken dialog exchanging the transcripts of a natural real-time conversation. Keep your responses short, generally within five sentences for chatty scenarios.';

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
