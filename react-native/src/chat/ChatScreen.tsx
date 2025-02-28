import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GiftedChat } from 'react-native-gifted-chat';
import {
  AppState,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  SafeAreaView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import { invokeBedrockWithCallBack as invokeBedrockWithCallBack } from '../api/bedrock-api';
import CustomMessageComponent from './component/CustomMessageComponent.tsx';
import { CustomScrollToBottomComponent } from './component/CustomScrollToBottomComponent.tsx';
import { EmptyChatComponent } from './component/EmptyChatComponent.tsx';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import uuid from 'uuid';
import { RouteParamList } from '../types/RouteTypes.ts';
import {
  getCurrentSystemPrompt,
  getImageModel,
  getMessagesBySessionId,
  getSessionId,
  getTextModel,
  saveCurrentSystemPrompt,
  saveMessageList,
  saveMessages,
  updateTotalUsage,
} from '../storage/StorageUtils.ts';
import {
  ChatMode,
  ChatStatus,
  FileInfo,
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
    },
  };
};
const imagePlaceholder = '![](bedrock://imgProgress)';
const textPlaceholder = '...';
type ChatScreenRouteProp = RouteProp<RouteParamList, 'Bedrock'>;
let currentMode = ChatMode.Text;

function ChatScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<ChatScreenRouteProp>();
  const initialSessionId = route.params?.sessionId;
  const tapIndex = route.params?.tapIndex;
  const mode = route.params?.mode ?? currentMode;
  const modeRef = useRef(mode);

  const [messages, setMessages] = useState<SwiftChatMessage[]>([]);
  const [systemPrompt, setSystemPrompt] = useState<SystemPrompt | null>(
    getCurrentSystemPrompt
  );
  const [showSystemPrompt, setShowSystemPrompt] = useState<boolean>(true);
  const [screenDimensions, setScreenDimensions] = useState(
    Dimensions.get('window')
  );
  const [chatStatus, setChatStatus] = useState<ChatStatus>(ChatStatus.Init);
  const [usage, setUsage] = useState<Usage>();
  const chatStatusRef = useRef(chatStatus);
  const messagesRef = useRef(messages);
  const bedrockMessages = useRef<BedrockMessage[]>([]);
  const flatListRef = useRef<FlatList<SwiftChatMessage>>(null);
  const textInputRef = useRef<TextInput>(null);
  const sessionIdRef = useRef(initialSessionId || getSessionId() + 1);
  const isCanceled = useRef(false);
  const { sendEvent, event, drawerType } = useAppContext();
  const sendEventRef = useRef(sendEvent);
  const inputTexRef = useRef('');
  const controllerRef = useRef<AbortController | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const selectedFilesRef = useRef(selectedFiles);
  const usageRef = useRef(usage);
  const systemPromptRef = useRef(systemPrompt);
  const drawerTypeRef = useRef(drawerType);

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
    if (selectedFiles.length > 0) {
      setShowSystemPrompt(false);
    }
  }, [selectedFiles]);

  // start new chat
  const startNewChat = useRef(
    useCallback(() => {
      trigger(HapticFeedbackTypes.impactMedium);
      sessionIdRef.current = getSessionId() + 1;
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
            textInputRef?.current?.clear();
            setUsage(undefined);
            setSelectedFiles([]);
            if (
              messagesRef.current.length > 0 &&
              chatStatusRef.current !== ChatStatus.Running
            ) {
              startNewChat.current();
            }
          }}
          imageSource={require('../assets/edit.png')}
        />
      ),
    };
    navigation.setOptions(headerOptions);
  }, [usage, navigation, mode, systemPrompt, showSystemPrompt]);

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
      modeRef.current = mode;
      setChatStatus(ChatStatus.Init);
      sendEventRef.current('');
      setUsage(undefined);
      if (initialSessionId === 0 || initialSessionId === -1) {
        startNewChat.current();
        return;
      }
      // click from history
      const msg = getMessagesBySessionId(initialSessionId);
      sessionIdRef.current = initialSessionId;
      setUsage((msg[0] as SwiftChatMessage).usage);
      setSystemPrompt(null);
      saveCurrentSystemPrompt(null);
      getBedrockMessagesFromChatMessages(msg).then(currentMessage => {
        bedrockMessages.current = currentMessage;
      });

      setMessages(msg);
      scrollToBottom();
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
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
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
      }
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
    };
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    return () => {
      subscription.remove();
    };
  }, []);

  // save current message
  const saveCurrentMessages = () => {
    if (messagesRef.current.length === 0) {
      return;
    }
    const currentSessionId = getSessionId();
    saveMessages(sessionIdRef.current, messagesRef.current, usageRef.current!);
    if (sessionIdRef.current > currentSessionId) {
      saveMessageList(
        sessionIdRef.current,
        messagesRef.current[messagesRef.current.length - 1],
        modeRef.current
      );
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
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd();
    }
  };
  const scrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
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
            }
            const previousMessage = messagesRef.current[0];
            if (
              previousMessage.text !== msg ||
              previousMessage.reasoning !== reasoning
            ) {
              setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                newMessages[0] = {
                  ...prevMessages[0],
                  text: msg,
                  reasoning: reasoning,
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
    setShowSystemPrompt(false);
    const files = selectedFilesRef.current;
    if (!isAllFileReady(files)) {
      showInfo('please wait for all videos to be ready');
      return;
    }
    if (message[0]?.text || files.length > 0) {
      if (!message[0]?.text) {
        message[0].text = getFileTypeSummary(files);
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
      return checkFileNumberLimit(prevFiles, files);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <GiftedChat
        messageContainerRef={flatListRef}
        textInputRef={textInputRef}
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
          <EmptyChatComponent chatMode={modeRef.current} />
        )}
        alwaysShowSend={
          chatStatus !== ChatStatus.Init || selectedFiles.length > 0
        }
        renderSend={props => (
          <CustomSendComponent
            {...props}
            chatStatus={chatStatus}
            chatMode={mode}
            selectedFiles={selectedFiles}
            onStopPress={() => {
              trigger(HapticFeedbackTypes.notificationWarning);
              isCanceled.current = true;
              controllerRef.current?.abort();
            }}
            onFileSelected={files => {
              handleNewFileSelected(files);
            }}
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
              setSystemPrompt(prompt);
              saveCurrentSystemPrompt(prompt);
            }}
            chatMode={modeRef.current}
            isShowSystemPrompt={showSystemPrompt}
          />
        )}
        renderMessage={props => (
          <CustomMessageComponent {...props} chatStatus={chatStatus} />
        )}
        listViewProps={{
          contentContainerStyle: styles.contentContainer,
          contentInset: { top: 2 },
        }}
        scrollToBottom={true}
        scrollToBottomComponent={CustomScrollToBottomComponent}
        scrollToBottomStyle={scrollStyle.scrollToBottomContainerStyle}
        textInputProps={{
          ...styles.textInputStyle,
          ...{
            fontWeight: isMac ? '300' : 'normal',
            color: 'black',
          },
        }}
        maxComposerHeight={isMac ? 360 : 200}
        onInputTextChanged={text => {
          if (
            isMac &&
            inputTexRef.current.length > 0 &&
            text[text.length - 1] === '\n' &&
            text[text.length - 2] !== ' ' &&
            text.length - inputTexRef.current.length === 1 &&
            chatStatusRef.current !== ChatStatus.Running
          ) {
            setTimeout(() => {
              if (textInputRef.current) {
                textInputRef.current.clear();
              }
            }, 1);
            const msg: SwiftChatMessage = {
              text: inputTexRef.current,
              user: { _id: 1 },
              createdAt: new Date(),
              _id: uuid.v4(),
            };
            onSend([msg]);
          }
          inputTexRef.current = text;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
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
});

export default ChatScreen;
