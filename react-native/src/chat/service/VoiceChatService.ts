import {
  NativeModules,
  NativeEventEmitter,
  EmitterSubscription,
} from 'react-native';
import { DefaultVoicePrompt } from '../../storage/Constants';
import {
  getCurrentVoiceSystemPrompt,
  getVoiceId,
  isTokenValid,
  getTokenInfo,
  getRegion,
} from '../../storage/StorageUtils.ts';
import { requestToken } from '../../api/bedrock-api.ts';

const { VoiceChatModule } = NativeModules;
const voiceChatEmitter = VoiceChatModule
  ? new NativeEventEmitter(VoiceChatModule)
  : null;

type ConversationState = 'idle' | 'listening' | 'speaking' | 'error';

export class VoiceChatService {
  private isInitialized = false;
  private subscriptions: EmitterSubscription[] = [];
  private onTranscriptReceivedCallback?: (role: string, text: string) => void;
  private onStateChangedCallback?: (
    state: ConversationState,
    error?: string
  ) => void;
  private onErrorCallback?: (message: string) => void;
  private onAudioLevelChangedCallback?: (source: string, level: number) => void;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Set callbacks for voice chat events
   * @param onTranscriptReceived Callback when transcript is received
   * @param onStateChanged Callback when state changes
   * @param onError Callback when error occurs
   * @param onAudioLevelChanged Callback when audio level changes
   */
  public setCallbacks(
    onTranscriptReceived?: (role: string, text: string) => void,
    onStateChanged?: (state: ConversationState, error?: string) => void,
    onError?: (message: string) => void,
    onAudioLevelChanged?: (source: string, level: number) => void
  ) {
    this.onTranscriptReceivedCallback = onTranscriptReceived;
    this.onStateChangedCallback = onStateChanged;
    this.onErrorCallback = onError;
    this.onAudioLevelChangedCallback = onAudioLevelChanged;
  }

  /**
   * Setup event listeners for voice chat events
   */
  private setupEventListeners() {
    if (voiceChatEmitter) {
      const transcriptSubscription = voiceChatEmitter.addListener(
        'onTranscriptReceived',
        event => {
          if (this.onTranscriptReceivedCallback) {
            this.onTranscriptReceivedCallback(event.role, event.text);
          }
        }
      );

      const stateSubscription = voiceChatEmitter.addListener(
        'onStateChanged',
        event => {
          if (this.onStateChangedCallback) {
            this.onStateChangedCallback(
              event.state as ConversationState,
              event.error
            );
          }
        }
      );

      const errorSubscription = voiceChatEmitter.addListener(
        'onError',
        event => {
          if (this.onErrorCallback) {
            this.onErrorCallback(event.message);
          }
        }
      );

      const audioLevelSubscription = voiceChatEmitter.addListener(
        'onAudioLevelChanged',
        event => {
          if (this.onAudioLevelChangedCallback) {
            this.onAudioLevelChangedCallback(event.source, event.level);
          }
        }
      );

      this.subscriptions = [
        transcriptSubscription,
        stateSubscription,
        errorSubscription,
        audioLevelSubscription,
      ];
    }
  }

  /**
   * Initialize voice chat module with AWS credentials
   * @returns Promise<boolean> True if initialization is successful
   */
  public async initialize(): Promise<boolean> {
    if (!VoiceChatModule) {
      if (this.onErrorCallback) {
        this.onErrorCallback('Voice chat module not available');
      }
      return false;
    }

    if (this.isInitialized) {
      return true;
    }

    try {
      // Check if token is valid, if not, request a new one
      if (!isTokenValid()) {
        const tokenResponse = await requestToken();
        if (!tokenResponse) {
          if (this.onErrorCallback) {
            this.onErrorCallback('Failed to get credentials');
          }
          return false;
        }
        if (tokenResponse.error) {
          if (this.onErrorCallback) {
            this.onErrorCallback(tokenResponse.error);
          }
          return false;
        }
      }

      // Get token info
      const tokenInfo = getTokenInfo();
      if (!tokenInfo) {
        if (this.onErrorCallback) {
          this.onErrorCallback('AWS credentials not available');
        }
        return false;
      }

      // Create config with token info
      const config = {
        region: getRegion(),
        accessKey: tokenInfo.accessKeyId,
        secretKey: tokenInfo.secretAccessKey,
        sessionToken: tokenInfo.sessionToken,
      };

      await VoiceChatModule.initialize(config);
      this.isInitialized = true;
      return true;
    } catch (err: unknown) {
      if (this.onErrorCallback) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.onErrorCallback(`Initialization failed: ${errorMessage}`);
      }
      return false;
    }
  }

  /**
   * Start a new conversation
   * @returns Promise<boolean> True if starting conversation is successful
   */
  public async startConversation(): Promise<boolean> {
    if (!VoiceChatModule) {
      if (this.onErrorCallback) {
        this.onErrorCallback('Voice chat module not available');
      }
      return false;
    }

    try {
      // Ensure module is initialized
      const voiceSystemPrompt = getCurrentVoiceSystemPrompt();
      if (!this.isInitialized) {
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          return false;
        }
      }

      // Start conversation with system prompt and voice ID
      const systemPrompt = voiceSystemPrompt?.prompt ?? DefaultVoicePrompt;
      const voiceId = getVoiceId();
      await VoiceChatModule.startConversation(
        systemPrompt,
        voiceId,
        voiceSystemPrompt?.allowInterruption ?? true
      );
      return true;
    } catch (err: unknown) {
      if (this.onErrorCallback) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.onErrorCallback(`Operation failed: ${errorMessage}`);
      }
      return false;
    }
  }

  /**
   * End the current conversation
   * @returns Promise<boolean> True if ending conversation is successful
   */
  public async endConversation(): Promise<boolean> {
    if (!VoiceChatModule || !this.isInitialized) {
      return false;
    }

    try {
      await VoiceChatModule.endConversation();
      return true;
    } catch (err: unknown) {
      if (this.onErrorCallback) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.onErrorCallback(`Failed to end conversation: ${errorMessage}`);
      }
      return false;
    }
  }

  /**
   * Clean up event listeners
   */
  public cleanup() {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
  }
}

// Create singleton instance
export const voiceChatService = new VoiceChatService();
