import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Composer, GiftedChat, InputToolbar } from 'react-native-gifted-chat';
import {
  AppState,
  Dimensions,
  FlatList,
  Keyboard,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  SafeAreaView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { voiceChatService } from './service/VoiceChatService';
import AudioWaveformComponent, {
  AudioWaveformRef,
} from './component/AudioWaveformComponent';
import { ColorScheme, useTheme } from '../theme';
import {
  invokeBedrockWithCallBack as invokeBedrockWithCallBack,
  requestToken,
} from '../api/bedrock-api';
import CustomMessageComponent from './component/CustomMessageComponent.tsx';
import { CustomScrollToBottomComponent } from './component/CustomScrollToBottomComponent.tsx';
import { EmptyChatComponent } from './component/EmptyChatComponent.tsx';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import uuid from 'uuid';
import { RouteParamList } from '../types/RouteTypes.ts';
import {
  getCurrentSystemPrompt,
  getCurrentVoiceSystemPrompt,
  getImageModel,
  getLastVirtualTryOnImgFile,
  getMessagesBySessionId,
  getSessionId,
  getTextModel,
  isTokenValid,
  saveCurrentImageSystemPrompt,
  saveCurrentSystemPrompt,
  saveCurrentVoiceSystemPrompt,
  saveLastVirtualTryOnImgFile,
  saveMessageList,
  saveMessages,
  updateTotalUsage,
} from '../storage/StorageUtils.ts';
import {
  ChatMode,
  ChatStatus,
  FileInfo,
  Metrics,
  SwiftChatMessage,
  SystemPrompt,
  Usage,
} from '../types/Chat.ts';
import { useAppContext } from '../history/AppProvider.tsx';
import { CustomHeaderRightButton } from './component/CustomHeaderRightButton.tsx';
import CustomSendComponent from './component/CustomSendComponent.tsx';
import {
  BedrockMessage,
  getBedrockMessage,
  getBedrockMessagesFromChatMessages,
} from './util/BedrockMessageConvertor.ts';
import { trigger } from './util/HapticUtils.ts';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types.ts';
import { isMac } from '../App.tsx';
import { CustomChatFooter } from './component/CustomChatFooter.tsx';
import {
  checkFileNumberLimit,
  getFileTypeSummary,
  isAllFileReady,
} from './util/FileUtils.ts';
import HeaderTitle from './component/HeaderTitle.tsx';
import { showInfo } from './util/ToastUtils.ts';
import { HeaderOptions } from '@react-navigation/elements';

const BOT_ID = 2;

const createBotMessage = (mode: string) => {
  return {
    _id: uuid.v4(),
    text: mode === ChatMode.Text ? textPlaceholder : imagePlaceholder,
    createdAt: new Date(),
    user: {
      _id: BOT_ID,
      name:
        mode === ChatMode.Text
          ? getTextModel().modelName
          : getImageModel().modelName,
      modelTag: mode === ChatMode.Text ? getTextModel().modelTag : undefined,
    },
  };
};
const imagePlaceholder = '![](bedrock://imgProgress)';
const textPlaceholder = '...';
type ChatScreenRouteProp = RouteProp<RouteParamList, 'Bedrock'>;
let currentMode = ChatMode.Text;

function ChatScreen(): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<ChatScreenRouteProp>();
  const initialSessionId = route.params?.sessionId;
  const tapIndex = route.params?.tapIndex;
  const mode = route.params?.mode ?? currentMode;
  const modeRef = useRef(mode);
  const isNovaSonic =
    getTextModel().modelId.includes('nova-sonic') &&
    modeRef.current === ChatMode.Text;

  const [messages, setMessages] = useState<SwiftChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [systemPrompt, setSystemPrompt] = useState<SystemPrompt | null>(
    isNovaSonic ? getCurrentVoiceSystemPrompt : getCurrentSystemPrompt
  );
  const [showSystemPrompt, setShowSystemPrompt] = useState<boolean>(true);
  const [screenDimensions, setScreenDimensions] = useState(
    Dimensions.get('window')
  );
  const [chatStatus, setChatStatus] = useState<ChatStatus>(ChatStatus.Init);
  const [usage, setUsage] = useState<Usage>();
  const [userScrolled, setUserScrolled] = useState(false);
  const chatStatusRef = useRef(chatStatus);
  const messagesRef = useRef(messages);
  const bedrockMessages = useRef<BedrockMessage[]>([]);
  const flatListRef = useRef<FlatList<SwiftChatMessage>>(null);
  const textInputViewRef = useRef<TextInput>(null);
  const sessionIdRef = useRef(initialSessionId || getSessionId() + 1);
  const isCanceled = useRef(false);
  const { sendEvent, event, drawerType } = useAppContext();
  const sendEventRef = useRef(sendEvent);
  const inputTextRef = useRef('');
  const [hasInputText, setHasInputText] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const selectedFilesRef = useRef(selectedFiles);
  const usageRef = useRef(usage);
  const systemPromptRef = useRef(systemPrompt);
  const drawerTypeRef = useRef(drawerType);
  const isVoiceLoading = useRef(false);
  const contentHeightRef = useRef(0);
  const containerHeightRef = useRef(0);
  const [isShowVoiceLoading, setIsShowVoiceLoading] = useState(false);
  const audioWaveformRef = useRef<AudioWaveformRef>(null);

  const endVoiceConversationRef = useRef<(() => Promise<boolean>) | null>(null);
  const currentScrollOffsetRef = useRef(0);
  const isNewChatRef = useRef(!initialSessionId);

  const endVoiceConversation = useCallback(async () => {
    audioWaveformRef.current?.resetAudioLevels();
    if (isVoiceLoading.current) {
      return Promise.resolve(false);
    }
    isVoiceLoading.current = true;
    setIsShowVoiceLoading(true);
    await voiceChatService.endConversation();
    setChatStatus(ChatStatus.Init);
    isVoiceLoading.current = false;
    setIsShowVoiceLoading(false);
    return true;
  }, []);

  useEffect(() => {
    endVoiceConversationRef.current = endVoiceConversation;
  }, [endVoiceConversation]);

  // update refs value with state
  useEffect(() => {
    messagesRef.current = messages;
    chatStatusRef.current = chatStatus;
    usageRef.current = usage;
  }, [chatStatus, messages, usage]);

  useEffect(() => {
    drawerTypeRef.current = drawerType;
  }, [drawerType]);

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  // Initialize voice chat service
  useEffect(() => {
    // Set up voice chat service callbacks
    voiceChatService.setCallbacks(
      // Handle transcript received
      (role, text) => {
        handleVoiceChatTranscript(role, text);
      },
      // Handle error
      message => {
        if (getTextModel().modelId.includes('nova-sonic')) {
          handleVoiceChatTranscript('ASSISTANT', message);
          endVoiceConversationRef.current?.();
          saveCurrentMessages();
          console.log('Voice chat error:', message);
        }
      }
    );

    // Clean up on unmounting
    return () => {
      voiceChatService.cleanup();
    };
  }, []);

  // start new chat
  const startNewChat = useRef(
    useCallback(() => {
      trigger(HapticFeedbackTypes.impactMedium);
      sessionIdRef.current = getSessionId() + 1;
      isNewChatRef.current = true;
      sendEventRef.current('updateHistorySelectedId', {
        id: sessionIdRef.current,
      });

      setMessages([]);
      bedrockMessages.current = [];
      setShowSystemPrompt(true);
      showKeyboard();
    }, [])
  );

  // header text and right button click
  React.useLayoutEffect(() => {
    currentMode = mode;
    systemPromptRef.current = systemPrompt;
    const headerOptions: HeaderOptions = {
      // eslint-disable-next-line react/no-unstable-nested-components
      headerTitle: () => (
        <HeaderTitle
          title={
            mode === ChatMode.Text
              ? systemPrompt
                ? systemPrompt.name
                : 'Chat'
              : 'Image'
          }
          usage={usage}
          onDoubleTap={scrollToTop}
          onShowSystemPrompt={() => setShowSystemPrompt(true)}
          isShowSystemPrompt={showSystemPrompt}
        />
      ),
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => (
        <CustomHeaderRightButton
          onPress={() => {
            //clear input content and selected files
            textInputViewRef?.current?.clear();
            setUsage(undefined);
            setSelectedFiles([]);
            if (
              messagesRef.current.length > 0 &&
              chatStatusRef.current !== ChatStatus.Running
            ) {
              startNewChat.current();
            }
          }}
          imageSource={
            isDark
              ? require('../assets/edit_dark.png')
              : require('../assets/edit.png')
          }
        />
      ),
    };
    navigation.setOptions(headerOptions);
  }, [usage, navigation, mode, systemPrompt, showSystemPrompt, isDark]);

  // sessionId changes (start new chat or click another session)
  useEffect(() => {
    if (tapIndex && initialSessionId) {
      if (sessionIdRef.current === initialSessionId) {
        return;
      }
      if (chatStatusRef.current === ChatStatus.Running) {
        // there are still a request sending, abort the request and save current messages
        controllerRef.current?.abort();
        chatStatusRef.current = ChatStatus.Init;
        if (modeRef.current === ChatMode.Image) {
          if (messagesRef.current[0].text === imagePlaceholder) {
            messagesRef.current[0].text = 'Request interrupted';
          }
        }
        saveCurrentMessages();
      }
      if (modeRef.current === ChatMode.Image) {
        setShowSystemPrompt(true);
      }
      if (modeRef.current !== mode) {
        // when change chat mode, clear system prompt and files
        modeRef.current = mode;
        setTimeout(() => {
          sendEventRef.current?.('unSelectSystemPrompt');
        }, 50);
        setSelectedFiles([]);
      }
      setChatStatus(ChatStatus.Init);
      sendEventRef.current('');
      setUsage(undefined);
      if (initialSessionId === 0 || initialSessionId === -1) {
        startNewChat.current();
        return;
      }
      // click from history
      setMessages([]);
      isNewChatRef.current = false;
      endVoiceConversationRef.current?.();
      setIsLoadingMessages(true);
      const msg = getMessagesBySessionId(initialSessionId);
      sessionIdRef.current = initialSessionId;
      setUsage((msg[0] as SwiftChatMessage).usage);
      setSystemPrompt(null);
      saveCurrentSystemPrompt(null);
      saveCurrentVoiceSystemPrompt(null);
      saveCurrentImageSystemPrompt(null);
      //notify to unselect prompt
      sendEventRef.current?.('unSelectSystemPrompt');
      getBedrockMessagesFromChatMessages(msg).then(currentMessage => {
        bedrockMessages.current = currentMessage;
      });
      if (isMac) {
        setMessages(msg);
        setIsLoadingMessages(false);
        scrollToBottom();
        showKeyboard();
      } else {
        setTimeout(() => {
          setMessages(msg);
          setIsLoadingMessages(false);
          scrollToBottom();
        }, 200);
      }
    }
  }, [initialSessionId, mode, tapIndex]);

  // deleteChat listener
  useEffect(() => {
    if (event?.event === 'deleteChat' && event.params) {
      const { id } = event.params;
      if (sessionIdRef.current === id) {
        sessionIdRef.current = getSessionId() + 1;
        sendEventRef.current('updateHistorySelectedId', {
          id: sessionIdRef.current,
        });
        setUsage(undefined);
        bedrockMessages.current = [];
        setMessages([]);
      }
    }
  }, [event]);

  // keyboard show listener for scroll to bottom
  useEffect(() => {
    const keyboardDidShowListener = Platform.select({
      ios: Keyboard.addListener('keyboardWillShow', scrollToBottom),
      android: Keyboard.addListener('keyboardDidShow', scrollToBottom),
    });

    return () => {
      keyboardDidShowListener && keyboardDidShowListener.remove();
    };
  }, []);

  // show keyboard for open the app
  useEffect(() => {
    showKeyboard();
  }, []);

  const showKeyboard = () => {
    setTimeout(() => {
      textInputViewRef.current?.focus();
    }, 100);
  };

  // update screenWith and height when screen rotate
  useEffect(() => {
    const updateDimensions = () => {
      setScreenDimensions(Dimensions.get('window'));
    };

    const subscription = Dimensions.addEventListener(
      'change',
      updateDimensions
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  // handle message complete update bedrockMessage and saveMessage
  useEffect(() => {
    if (chatStatus === ChatStatus.Complete) {
      if (messagesRef.current.length <= 1) {
        return;
      }
      saveCurrentMessages();
      getBedrockMessage(messagesRef.current[0]).then(currentMsg => {
        bedrockMessages.current.push(currentMsg);
      });
      if (drawerTypeRef.current === 'permanent') {
        sendEventRef.current('updateHistory');
        setTimeout(() => {
          sendEventRef.current('updateHistorySelectedId', {
            id: sessionIdRef.current,
          });
        }, 100);
      }
      // Notify Mermaid renderers to refresh after streaming completes
      setTimeout(() => {
        sendEventRef.current('refreshMermaid');
      }, 150);
      setChatStatus(ChatStatus.Init);
    }
  }, [chatStatus]);

  // app goes to background and save running messages.
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (chatStatusRef.current === ChatStatus.Running) {
          saveCurrentMessages();
        }
      }
      if (nextAppState === 'active') {
        if (!isTokenValid()) {
          requestToken().then();
        }
      }
    };
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    return () => {
      subscription.remove();
    };
  }, []);

  // save the current message
  const saveCurrentMessages = () => {
    if (messagesRef.current.length === 0) {
      return;
    }
    const currentSessionId = getSessionId();
    if (isNewChatRef.current) {
      if (sessionIdRef.current <= currentSessionId) {
        //update sessionID
        sessionIdRef.current = currentSessionId + 1;
        setTimeout(() => {
          sendEventRef.current('updateHistorySelectedId', {
            id: sessionIdRef.current,
          });
        }, 100);
      }
    }
    saveMessages(sessionIdRef.current, messagesRef.current, usageRef.current!);
    if (isNewChatRef.current) {
      saveMessageList(
        sessionIdRef.current,
        messagesRef.current[messagesRef.current.length - 1],
        modeRef.current
      );
      isNewChatRef.current = false;
    }
  };

  const { width: screenWidth, height: screenHeight } = screenDimensions;

  const chatScreenWidth =
    isMac && drawerType === 'permanent' ? screenWidth - 300 : screenWidth;

  const scrollStyle = StyleSheet.create({
    scrollToBottomContainerStyle: {
      width: 30,
      height: 30,
      left:
        Platform.OS === 'ios' &&
        screenHeight < screenWidth &&
        screenHeight < 500
          ? screenWidth / 2 - 75 // iphone landscape
          : chatScreenWidth / 2 - 15,
      bottom: screenHeight > screenWidth ? '1.5%' : '2%',
    },
  });

  const scrollToTop = () => {
    setUserScrolled(true);
    if (flatListRef.current) {
      if (messagesRef.current.length > 0) {
        flatListRef.current.scrollToIndex({
          index: messagesRef.current.length - 1,
          animated: true,
        });
      }
    }
  };
  const scrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const scrollUpByHeight = (
    expanded: boolean,
    height: number,
    animated: boolean
  ) => {
    if (flatListRef.current) {
      const newOffset =
        currentScrollOffsetRef.current + (expanded ? height : -height);
      flatListRef.current.scrollToOffset({
        offset: newOffset,
        animated: animated,
      });
    }
  };

  const handleScroll = (
    scrollEvent: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    currentScrollOffsetRef.current = scrollEvent.nativeEvent.contentOffset.y;
  };

  const handleUserScroll = (_: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (chatStatusRef.current === ChatStatus.Running) {
      setUserScrolled(true);
    }
  };

  const handleMomentumScrollEnd = (
    endEvent: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (chatStatusRef.current === ChatStatus.Running && userScrolled) {
      const { contentOffset } = endEvent.nativeEvent;
      if (contentOffset.y > 0 && contentOffset.y < 100) {
        scrollToBottom();
      }
    }
  };

  // invoke bedrock api
  useEffect(() => {
    const lastMessage = messages[0];
    if (
      lastMessage &&
      lastMessage.user &&
      lastMessage.user._id === BOT_ID &&
      lastMessage.text ===
        (modeRef.current === ChatMode.Text
          ? textPlaceholder
          : imagePlaceholder) &&
      chatStatusRef.current === ChatStatus.Running
    ) {
      if (modeRef.current === ChatMode.Image) {
        sendEventRef.current('onImageStart');
      }
      controllerRef.current = new AbortController();
      isCanceled.current = false;
      const startRequestTime = new Date().getTime();
      let latencyMs = 0;
      let metrics: Metrics | undefined;
      invokeBedrockWithCallBack(
        bedrockMessages.current,
        modeRef.current,
        systemPromptRef.current,
        () => isCanceled.current,
        controllerRef.current,
        (
          msg: string,
          complete: boolean,
          needStop: boolean,
          usageInfo?: Usage,
          reasoning?: string
        ) => {
          if (chatStatusRef.current !== ChatStatus.Running) {
            return;
          }
          if (latencyMs === 0) {
            latencyMs = new Date().getTime() - startRequestTime;
          }
          const updateMessage = () => {
            if (usageInfo) {
              setUsage(prevUsage => ({
                modelName: usageInfo.modelName,
                inputTokens:
                  (prevUsage?.inputTokens || 0) + usageInfo.inputTokens,
                outputTokens:
                  (prevUsage?.outputTokens || 0) + usageInfo.outputTokens,
                totalTokens:
                  (prevUsage?.totalTokens || 0) + usageInfo.totalTokens,
              }));
              updateTotalUsage(usageInfo);
              const renderSec =
                (new Date().getTime() - startRequestTime - latencyMs) / 1000;
              const speed = usageInfo.outputTokens / renderSec;
              if (!metrics && modeRef.current === ChatMode.Text) {
                metrics = {
                  latencyMs: (latencyMs / 1000).toFixed(2),
                  speed: speed.toFixed(speed > 100 ? 1 : 2),
                };
              }
            }
            const previousMessage = messagesRef.current[0];
            if (
              previousMessage.text !== msg ||
              previousMessage.reasoning !== reasoning ||
              (!previousMessage.metrics && metrics)
            ) {
              setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                newMessages[0] = {
                  ...prevMessages[0],
                  text:
                    isCanceled.current &&
                    (previousMessage.text === textPlaceholder ||
                      previousMessage.text === '')
                      ? 'Canceled...'
                      : msg,
                  reasoning: reasoning,
                  metrics: metrics,
                };
                return newMessages;
              });
            }
          };
          const setComplete = () => {
            trigger(HapticFeedbackTypes.notificationSuccess);
            setChatStatus(ChatStatus.Complete);
          };
          if (modeRef.current === ChatMode.Text) {
            trigger(HapticFeedbackTypes.selection);
            updateMessage();
            if (complete) {
              setComplete();
            }
          } else {
            if (needStop) {
              sendEventRef.current('onImageStop');
            } else {
              sendEventRef.current('onImageComplete');
            }
            setTimeout(() => {
              updateMessage();
              setComplete();
            }, 1000);
          }
          if (needStop) {
            isCanceled.current = true;
          }
        }
      ).then();
    }
  }, [messages]);

  // handle onSend
  const onSend = useCallback((message: SwiftChatMessage[] = []) => {
    // Reset user scroll state when sending a new message
    setUserScrolled(false);
    setShowSystemPrompt(modeRef.current === ChatMode.Image);
    const files = selectedFilesRef.current;
    if (!isAllFileReady(files)) {
      showInfo('please wait for all videos to be ready');
      return;
    }
    if (message[0]?.text || files.length > 0) {
      if (!message[0]?.text) {
        if (modeRef.current === ChatMode.Text) {
          // use system prompt name as user prompt
          if (systemPromptRef.current) {
            message[0].text = systemPromptRef.current.name;
          } else {
            message[0].text = getFileTypeSummary(files);
          }
        } else {
          // use selected system prompt as user prompt
          message[0].text = systemPromptRef.current?.prompt ?? 'Empty Message';
          if (systemPromptRef.current?.id === -7) {
            saveLastVirtualTryOnImgFile(files[0]);
            saveCurrentImageSystemPrompt(null);
            sendEventRef.current('unSelectSystemPrompt');
          }
        }
      } else {
        // append user prompt after system prompt in image mode
        if (modeRef.current === ChatMode.Image && systemPromptRef.current) {
          message[0].text =
            systemPromptRef.current?.prompt + '\n' + message[0].text;
        }
      }
      if (selectedFilesRef.current.length > 0) {
        message[0].image = JSON.stringify(selectedFilesRef.current);
        setSelectedFiles([]);
      }
      trigger(HapticFeedbackTypes.impactMedium);
      scrollToBottom();
      getBedrockMessage(message[0]).then(currentMsg => {
        bedrockMessages.current.push(currentMsg);
        setChatStatus(ChatStatus.Running);
        setMessages(previousMessages => [
          createBotMessage(modeRef.current),
          ...GiftedChat.append(previousMessages, message),
        ]);
      });
    }
  }, []);

  const handleNewFileSelected = (files: FileInfo[]) => {
    setSelectedFiles(prevFiles => {
      const isVirtualTryOn =
        modeRef.current === ChatMode.Image &&
        systemPromptRef.current?.id === -7;
      return checkFileNumberLimit(
        prevFiles,
        files,
        modeRef.current,
        isVirtualTryOn
      );
    });
  };

  const handleVoiceChatTranscript = (role: string, text: string) => {
    const userId = role === 'USER' ? 1 : BOT_ID;
    if (
      messagesRef.current.length > 0 &&
      messagesRef.current[0].user._id === userId
    ) {
      if (userId === 1) {
        text = ' ' + text;
      }
      setMessages(previousMessages => {
        const newMessages = [...previousMessages];
        if (!newMessages[0].text.includes(text)) {
          newMessages[0] = {
            ...newMessages[0],
            text: newMessages[0].text + text,
          };
        }
        return newMessages;
      });
    } else {
      const newMessage: SwiftChatMessage = {
        _id: uuid.v4(),
        text: text,
        createdAt: new Date(),
        user: {
          _id: userId,
          name: role === 'USER' ? 'You' : getTextModel().modelName,
          modelTag: role === 'USER' ? undefined : getTextModel().modelTag,
        },
      };

      setMessages(previousMessages => [newMessage, ...previousMessages]);
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <GiftedChat
        messageContainerRef={flatListRef}
        textInputRef={textInputViewRef}
        keyboardShouldPersistTaps="never"
        bottomOffset={
          Platform.OS === 'android'
            ? 0
            : screenHeight > screenWidth && screenWidth < 500
            ? 32 // iphone in portrait
            : 20
        }
        messages={messages}
        onSend={onSend}
        user={{
          _id: 1,
        }}
        alignTop={false}
        inverted={true}
        renderChatEmpty={() => (
          <EmptyChatComponent
            chatMode={modeRef.current}
            isLoadingMessages={isLoadingMessages}
          />
        )}
        alwaysShowSend={
          chatStatus !== ChatStatus.Init || selectedFiles.length > 0
        }
        renderComposer={props => {
          if (isNovaSonic && mode === ChatMode.Text) {
            return <AudioWaveformComponent ref={audioWaveformRef} />;
          }

          // Default input box
          return (
            <Composer {...props} textInputStyle={styles.composerTextInput} />
          );
        }}
        renderSend={props => (
          <CustomSendComponent
            {...props}
            chatStatus={chatStatus}
            chatMode={mode}
            selectedFiles={selectedFiles}
            isShowLoading={isShowVoiceLoading}
            onStopPress={() => {
              trigger(HapticFeedbackTypes.notificationWarning);
              if (isNovaSonic) {
                // End voice chat conversation
                endVoiceConversation().then(success => {
                  if (success) {
                    trigger(HapticFeedbackTypes.impactMedium);
                  }
                });
                saveCurrentMessages();
              } else {
                isCanceled.current = true;
                controllerRef.current?.abort();
              }
            }}
            onFileSelected={files => {
              handleNewFileSelected(files);
            }}
            onVoiceChatToggle={() => {
              if (isVoiceLoading.current) {
                return;
              }
              isVoiceLoading.current = true;
              setIsShowVoiceLoading(true);
              voiceChatService.startConversation().then(success => {
                if (!success) {
                  setChatStatus(ChatStatus.Init);
                } else {
                  setChatStatus(ChatStatus.Running);
                }
                isVoiceLoading.current = false;
                setIsShowVoiceLoading(false);
                trigger(HapticFeedbackTypes.impactMedium);
              });
            }}
            systemPrompt={systemPrompt}
          />
        )}
        renderChatFooter={() => (
          <CustomChatFooter
            files={selectedFiles}
            onFileUpdated={(files, isUpdate) => {
              if (isUpdate) {
                setSelectedFiles(files);
              } else {
                handleNewFileSelected(files);
              }
            }}
            onSystemPromptUpdated={prompt => {
              const lastPromptIsVirtualTryOn = systemPrompt?.id === -7;
              setSystemPrompt(prompt);
              if (modeRef.current === ChatMode.Image) {
                saveCurrentImageSystemPrompt(prompt);
                if (prompt?.id === -7) {
                  const lastVirtualTryOnImgFile = getLastVirtualTryOnImgFile();
                  if (lastVirtualTryOnImgFile) {
                    setSelectedFiles([lastVirtualTryOnImgFile]);
                  }
                } else {
                  //clear virtual try on image when prompt changes
                  if (selectedFiles.length > 0 && lastPromptIsVirtualTryOn) {
                    setSelectedFiles([]);
                  }
                }
              } else if (isNovaSonic) {
                saveCurrentVoiceSystemPrompt(prompt);
                if (chatStatus === ChatStatus.Running) {
                  endVoiceConversationRef.current?.();
                }
              } else {
                saveCurrentSystemPrompt(prompt);
              }
            }}
            onSwitchedToTextModel={() => {
              endVoiceConversationRef.current?.();
            }}
            chatMode={modeRef.current}
            isShowSystemPrompt={showSystemPrompt}
            hasInputText={hasInputText}
            chatStatus={chatStatus}
            systemPrompt={systemPrompt}
          />
        )}
        renderMessage={props => {
          // Find the index of the current message in the messages array
          const messageIndex = messages.findIndex(
            msg => msg._id === props.currentMessage?._id
          );

          return (
            <CustomMessageComponent
              {...props}
              chatStatus={chatStatus}
              isLastAIMessage={
                props.currentMessage?._id === messages[0]?._id &&
                props.currentMessage?.user._id !== 1
              }
              onReasoningToggle={(expanded, height, animated) => {
                scrollUpByHeight(expanded, height, animated);
              }}
              onRegenerate={() => {
                setUserScrolled(false);
                trigger(HapticFeedbackTypes.impactMedium);
                const userMessageIndex = messageIndex + 1;
                if (userMessageIndex < messages.length) {
                  // Reset bedrockMessages to only include the user's message
                  getBedrockMessage(messages[userMessageIndex]).then(
                    userMsg => {
                      bedrockMessages.current = [userMsg];
                      setChatStatus(ChatStatus.Running);
                      setMessages(previousMessages => [
                        createBotMessage(modeRef.current),
                        ...previousMessages.slice(userMessageIndex),
                      ]);
                    }
                  );
                }
              }}
            />
          );
        }}
        listViewProps={{
          contentContainerStyle: styles.contentContainer,
          contentInset: { top: 2 },
          onLayout: (layoutEvent: LayoutChangeEvent) => {
            containerHeightRef.current = layoutEvent.nativeEvent.layout.height;
          },
          onScrollEvent: handleScroll,
          onContentSizeChange: (_width: number, height: number) => {
            contentHeightRef.current = height;
          },
          onScrollBeginDrag: handleUserScroll,
          onMomentumScrollEnd: handleMomentumScrollEnd,
          ...(userScrolled &&
          chatStatus === ChatStatus.Running &&
          contentHeightRef.current > containerHeightRef.current
            ? {
                maintainVisibleContentPosition: {
                  minIndexForVisible: 0,
                  autoscrollToTopThreshold: 0,
                },
              }
            : {}),
        }}
        scrollToBottom={true}
        scrollToBottomComponent={CustomScrollToBottomComponent}
        scrollToBottomStyle={scrollStyle.scrollToBottomContainerStyle}
        renderInputToolbar={props => (
          <InputToolbar
            {...props}
            containerStyle={{
              backgroundColor: colors.background,
              borderTopColor: colors.chatScreenSplit,
            }}
          />
        )}
        textInputProps={{
          ...styles.textInputStyle,
          ...{
            fontWeight: isMac ? '300' : 'normal',
            color: colors.text,
            blurOnSubmit: isMac,
            onSubmitEditing: () => {
              if (
                inputTextRef.current.length > 0 &&
                chatStatusRef.current !== ChatStatus.Running
              ) {
                const msg: SwiftChatMessage = {
                  text: inputTextRef.current,
                  user: { _id: 1 },
                  createdAt: new Date(),
                  _id: uuid.v4(),
                };
                onSend([msg]);
                inputTextRef.current = '';
                setHasInputText(false);
                textInputViewRef.current?.clear();
                setTimeout(() => {
                  textInputViewRef.current?.clear();
                  textInputViewRef.current?.focus();
                }, 50);
              } else {
                setTimeout(() => {
                  textInputViewRef.current?.focus();
                }, 50);
              }
            },
          },
        }}
        maxComposerHeight={isMac ? 360 : 200}
        onInputTextChanged={text => {
          if (
            isMac &&
            text.length > 0 &&
            (text[text.length - 1] === '\n' ||
              text.length - 1 === inputTextRef.current.length)
          ) {
            setTimeout(() => {
              textInputViewRef.current?.focus();
            }, 50);
          }
          inputTextRef.current = text;
          if (!hasInputText && text.length > 0) {
            setHasInputText(true);
          }
          if (hasInputText && text.length === 0) {
            setHasInputText(false);
          }
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      paddingTop: 15,
      paddingBottom: 15,
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    textInputStyle: {
      marginLeft: 14,
      lineHeight: 22,
    },
    composerTextInput: {
      backgroundColor: colors.background,
      color: colors.text,
    },
  });

export default ChatScreen;
