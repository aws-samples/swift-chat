import { ChatMode, SavedApp, SystemPrompt } from './Chat.ts';
import { NavigatorScreenParams } from '@react-navigation/native';

// Drawer Navigator params (nested inside Stack)
export type DrawerParamList = {
  Bedrock: {
    sessionId?: number;
    tapIndex?: number;
    mode?: ChatMode;
  };
  Settings: NonNullable<unknown>;
};

// Stack Navigator params (root)
export type RouteParamList = {
  Drawer: NavigatorScreenParams<DrawerParamList>;
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
  AppGallery: NonNullable<unknown>;
  AppViewer: {
    app: SavedApp;
  };
  ImageGallery: NonNullable<unknown>;
};
