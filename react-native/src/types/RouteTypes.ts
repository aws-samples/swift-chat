import { ChatMode, SystemPrompt } from './Chat.ts';

export type RouteParamList = {
  Bedrock: {
    sessionId?: number;
    tapIndex?: number;
    mode?: ChatMode;
  };
  Settings: NonNullable<unknown>;
  TokenUsage: NonNullable<unknown>;
  Prompt: {
    prompt?: SystemPrompt;
    promptType?: string | undefined;
  };
};
