import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputSelectionChangeEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import Share from 'react-native-share';
import { MessageProps } from 'react-native-gifted-chat';
import { CustomMarkdownRenderer } from './markdown/CustomMarkdownRenderer.tsx';
import { MarkedStyles } from 'react-native-marked/src/theme/types.ts';
import {
  ChatStatus,
  ModelTag,
  PressMode,
  SwiftChatMessage,
} from '../../types/Chat.ts';
import { trigger } from '../util/HapticUtils.ts';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types.ts';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  CustomFileListComponent,
  DisplayMode,
} from './CustomFileListComponent.tsx';
import FileViewer from 'react-native-file-viewer';
import { isMac } from '../../App.tsx';
import { CustomTokenizer } from './markdown/CustomTokenizer.ts';
import Markdown from './markdown/Markdown.tsx';
import ImageSpinner from './ImageSpinner.tsx';
import { State, TapGestureHandler } from 'react-native-gesture-handler';
import { getModelTagByUserName } from '../../utils/ModelUtils.ts';
import { isAndroid } from '../../utils/PlatformUtils.ts';

interface CustomMessageProps extends MessageProps<SwiftChatMessage> {
  chatStatus: ChatStatus;
  isLastAIMessage?: boolean;
  onRegenerate?: () => void;
}

const CustomMessageComponent: React.FC<CustomMessageProps> = ({
  currentMessage,
  chatStatus,
  isLastAIMessage,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const [clickTitleCopied, setClickTitleCopied] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const [inputHeight, setInputHeight] = useState(0);
  const chatStatusRef = useRef(chatStatus);
  const textInputRef = useRef<TextInput>(null);
  const [inputTextSelection, setInputTextSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  const isLoading =
    chatStatus === ChatStatus.Running && currentMessage?.text === '...';
  const [forceShowButtons, setForceShowButtons] = useState(false);

  const setIsEditValue = useCallback(
    (value: boolean) => {
      if (chatStatus !== ChatStatus.Running) {
        setIsEdit(value);
        if (!value) {
          setInputTextSelection(undefined);
        }
      }
    },
    [chatStatus]
  );

  // Use useEffect with setTimeout to ensure selection happens after TextInput is fully rendered
  useEffect(() => {
    if (!isAndroid && isEdit && currentMessage?.text) {
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
        setInputTextSelection({
          start: 0,
          end: currentMessage.text.length,
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isEdit, currentMessage?.text]);

  const toggleButtons = useCallback(() => {
    setForceShowButtons(prev => !prev);
  }, []);

  // Handle selection changes made by the user
  const handleSelectionChange = useCallback(
    (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const { selection } = event.nativeEvent;
      setInputTextSelection(selection);
    },
    []
  );

  const handleCopy = useCallback(() => {
    const copyText = currentMessage?.reasoning
      ? 'Reasoning: ' +
          currentMessage.reasoning +
          '\n\n' +
          currentMessage?.text || ''
      : currentMessage?.text || '';
    Clipboard.setString(copyText);
  }, [currentMessage?.reasoning, currentMessage?.text]);

  const userInfo = useMemo(() => {
    if (!currentMessage) {
      return { userName: '', imgSource: null };
    }
    const user = currentMessage.user;
    const userName = user._id === 1 ? 'You' : user.name ?? 'Bedrock';
    const currentModelTag = getModelTagByUserName(user.modelTag, userName);

    const modelIcon =
      currentModelTag === ModelTag.DeepSeek
        ? require('../../assets/deepseek.png')
        : currentModelTag === ModelTag.OpenAICompatible
        ? require('../../assets/openai_api.png')
        : currentModelTag === ModelTag.OpenAI
        ? require('../../assets/openai.png')
        : currentModelTag === ModelTag.Ollama
        ? require('../../assets/ollama_white.png')
        : require('../../assets/bedrock.png');

    const imgSource =
      currentMessage.user._id === 1
        ? require('../../assets/user.png')
        : modelIcon;

    return { userName, imgSource };
  }, [currentMessage]);

  const headerContent = useMemo(() => {
    return (
      <>
        <Image source={userInfo.imgSource} style={styles.avatar} />
        <Text style={styles.name}>{userInfo.userName}</Text>
      </>
    );
  }, [userInfo]);

  const copyButton = useMemo(() => {
    return clickTitleCopied ? (
      <Image source={require('../../assets/done.png')} style={styles.copy} />
    ) : null;
  }, [clickTitleCopied]);

  const handleImagePress = useCallback((pressMode: PressMode, url: string) => {
    if (pressMode === PressMode.Click) {
      FileViewer.open(url)
        .then(() => {})
        .catch(error => {
          console.log(error);
        });
    } else if (pressMode === PressMode.LongPress) {
      trigger(HapticFeedbackTypes.notificationSuccess);
      const shareOptions = { url: url, type: 'image/png', title: 'AI Image' };
      Share.open(shareOptions)
        .then(res => console.log(res))
        .catch(err => err && console.log(err));
    }
  }, []);

  const customMarkdownRenderer = useMemo(
    () => new CustomMarkdownRenderer(handleImagePress),
    [handleImagePress]
  );

  const customTokenizer = useMemo(() => new CustomTokenizer(), []);

  const reasoningSection = useMemo(() => {
    if (
      !currentMessage?.reasoning ||
      currentMessage?.reasoning.length === 0 ||
      currentMessage.user._id === 1
    ) {
      return null;
    }

    return (
      <View style={styles.reasoningContainer}>
        <View style={styles.reasoningHeader}>
          <Text style={styles.reasoningTitle}>Reasoning</Text>
        </View>

        <View style={styles.reasoningContent}>
          <Markdown
            value={currentMessage.reasoning}
            flatListProps={{
              style: {
                backgroundColor: '#f3f3f3',
              },
            }}
            styles={customMarkedStyles}
            renderer={customMarkdownRenderer}
            tokenizer={customTokenizer}
            chatStatus={chatStatusRef.current}
          />
        </View>
      </View>
    );
  }, [currentMessage, customMarkdownRenderer, customTokenizer]);

  const handleShowButton = useCallback(() => {
    if (!isLoading) {
      toggleButtons();
    }
  }, [isLoading, toggleButtons]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [copied]);

  useEffect(() => {
    if (clickTitleCopied) {
      handleCopy();
      const timer = setTimeout(() => {
        setClickTitleCopied(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [handleCopy, clickTitleCopied]);

  const messageContent = useMemo(() => {
    if (!currentMessage) {
      return null;
    }

    if (currentMessage.user._id !== 1) {
      return (
        <Markdown
          value={currentMessage.text}
          styles={customMarkedStyles}
          renderer={customMarkdownRenderer}
          tokenizer={customTokenizer}
          chatStatus={chatStatusRef.current}
        />
      );
    }

    return <Text style={styles.questionText}>{currentMessage.text}</Text>;
  }, [currentMessage, customMarkdownRenderer, customTokenizer]);

  const messageActionButtons = useMemo(() => {
    return (
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          onPress={() => {
            handleCopy();
            setCopied(true);
          }}
          style={styles.actionButton}>
          <Image
            source={
              copied
                ? require('../../assets/done.png')
                : require('../../assets/copy_grey.png')
            }
            style={styles.actionButtonIcon}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsEditValue(!isEdit)}
          style={styles.actionButton}>
          <Image
            source={
              isEdit
                ? require('../../assets/select.png')
                : require('../../assets/select_grey.png')
            }
            style={styles.actionButtonIcon}
          />
        </TouchableOpacity>

        {currentMessage?.user._id !== 1 && (
          <TouchableOpacity onPress={onRegenerate} style={styles.actionButton}>
            <Image
              source={require('../../assets/refresh.png')}
              style={styles.actionButtonIcon}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [
    handleCopy,
    copied,
    isEdit,
    onRegenerate,
    setIsEditValue,
    currentMessage,
  ]);

  if (!currentMessage) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={1}
        onPress={() => setClickTitleCopied(true)}>
        {headerContent}
        {copyButton}
      </TouchableOpacity>
      <View style={styles.marked_box}>
        {isLoading && (
          <View style={styles.loading}>
            <ImageSpinner
              visible={true}
              size={18}
              source={require('../../assets/loading.png')}
            />
          </View>
        )}
        {!isLoading && reasoningSection}
        {!isLoading && !isEdit && (
          <TapGestureHandler
            numberOfTaps={2}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state === State.ACTIVE) {
                handleShowButton();
              }
            }}>
            <View>{messageContent}</View>
          </TapGestureHandler>
        )}
        {isEdit && (
          <TextInput
            ref={textInputRef}
            selection={inputTextSelection}
            onSelectionChange={handleSelectionChange}
            editable={Platform.OS === 'android'}
            multiline
            showSoftInputOnFocus={false}
            onContentSizeChange={event => {
              const { height } = event.nativeEvent.contentSize;
              setInputHeight(height);
            }}
            style={[
              styles.inputText,
              // eslint-disable-next-line react-native/no-inline-styles
              {
                fontWeight: isMac ? '300' : 'normal',
                lineHeight: isMac ? 26 : Platform.OS === 'android' ? 24 : 28,
                paddingTop: Platform.OS === 'android' ? 7 : 3,
                marginBottom: -inputHeight * (isAndroid ? 0 : 0.138) + 8,
              },
            ]}
            textAlignVertical="top">
            {currentMessage.text}
          </TextInput>
        )}
        {((isLastAIMessage && chatStatus !== ChatStatus.Running) ||
          forceShowButtons) &&
          messageActionButtons}
        {currentMessage.image && (
          <CustomFileListComponent
            files={JSON.parse(currentMessage.image)}
            mode={DisplayMode.Display}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginLeft: 12,
    marginRight: 8,
    marginVertical: 4,
  },
  marked_box: {
    marginLeft: 28,
    marginRight: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 6,
  },
  copy: {
    width: 18,
    height: 18,
    marginRight: 20,
    marginLeft: 'auto',
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
  },
  questionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 6,
    color: '#333',
  },
  inputText: {
    fontSize: 16,
    lineHeight: 26,
    textAlignVertical: 'top',
    marginTop: 1,
    padding: 0,
    fontWeight: '300',
    color: '#333',
    letterSpacing: 0,
  },
  reasoningContainer: {
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f3f3f3',
    overflow: 'hidden',
    marginTop: 8,
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#eaeaea',
  },
  reasoningTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  reasoningContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  loading: {
    marginTop: 12,
    marginBottom: 10,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginLeft: -8,
    marginTop: -2,
    marginBottom: 4,
  },
  actionButton: {
    padding: 8,
  },
  actionButtonIcon: {
    width: 16,
    height: 16,
  },
});

const customMarkedStyles: MarkedStyles = {
  table: { marginVertical: 4 },
  li: { paddingVertical: 4 },
  h1: { fontSize: 28 },
  h2: { fontSize: 24 },
  h3: { fontSize: 20 },
  h4: { fontSize: 18 },
  blockquote: { marginVertical: 8 },
  paragraph: { paddingVertical: 6 },
};

export default React.memo(CustomMessageComponent, (prevProps, nextProps) => {
  return (
    prevProps.currentMessage?.text === nextProps.currentMessage?.text &&
    prevProps.currentMessage?.image === nextProps.currentMessage?.image &&
    prevProps.currentMessage?.reasoning ===
      nextProps.currentMessage?.reasoning &&
    prevProps.chatStatus === nextProps.chatStatus &&
    prevProps.isLastAIMessage === nextProps.isLastAIMessage &&
    prevProps.onRegenerate === nextProps.onRegenerate
  );
});
