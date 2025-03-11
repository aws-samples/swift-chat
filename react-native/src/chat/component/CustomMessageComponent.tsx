import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Share from 'react-native-share';
import { MessageProps } from 'react-native-gifted-chat';
import { CustomMarkdownRenderer } from './markdown/CustomMarkdownRenderer.tsx';
import { MarkedStyles } from 'react-native-marked/src/theme/types.ts';
import { ChatStatus, PressMode, SwiftChatMessage } from '../../types/Chat.ts';
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
import { State, TapGestureHandler } from 'react-native-gesture-handler';
import Markdown from './markdown/Markdown.tsx';
import { DeepSeekModels } from '../../storage/Constants.ts';
import { getTextModel } from '../../storage/StorageUtils.ts';

interface CustomMessageProps extends MessageProps<SwiftChatMessage> {
  chatStatus: ChatStatus;
}

const CustomMessageComponent: React.FC<CustomMessageProps> = ({
  currentMessage,
  chatStatus,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const inputHeightRef = useRef(0);
  const chatStatusRef = useRef(chatStatus);

  const setIsEditValue = useCallback(
    (value: boolean) => {
      if (chatStatus !== ChatStatus.Running) {
        setIsEdit(value);
      }
    },
    [chatStatus]
  );

  const handleCopy = useCallback(() => {
    if (isEdit) {
      setIsEditValue(false);
      return;
    }
    const copyText = currentMessage?.reasoning
      ? 'Reasoning: ' +
          currentMessage.reasoning +
          '\n\n' +
          currentMessage?.text || ''
      : currentMessage?.text || '';
    Clipboard.setString(copyText);
    setCopied(true);
  }, [isEdit, setIsEditValue, currentMessage?.reasoning, currentMessage?.text]);

  const userInfo = useMemo(() => {
    if (!currentMessage) {
      return { userName: '', imgSource: null };
    }

    const userName =
      currentMessage.user._id === 1
        ? 'You'
        : currentMessage.user.name ?? 'Bedrock';
    const isDeepSeek = DeepSeekModels.some(
      model => model.modelId === getTextModel().modelId
    );
    const isOpenAI = userName.includes('GPT');
    const isOllama = userName.includes(':');

    const modelIcon = isDeepSeek
      ? require('../../assets/deepseek.png')
      : isOpenAI
      ? require('../../assets/openai.png')
      : isOllama
      ? require('../../assets/ollama-white.png')
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
    return (
      <TouchableOpacity onPress={handleCopy} style={styles.copyContainer}>
        <Image
          source={
            isEdit
              ? require('../../assets/select.png')
              : copied
              ? require('../../assets/done.png')
              : require('../../assets/copy_grey.png')
          }
          style={styles.copy}
        />
      </TouchableOpacity>
    );
  }, [isEdit, copied, handleCopy]);

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

  const handleEdit = useCallback(() => {
    setIsEditValue(!isEdit);
  }, [isEdit, setIsEditValue]);

  const onDoubleTap = useCallback(() => {
    setIsEditValue(true);
  }, [setIsEditValue]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [copied]);

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

  if (!currentMessage) {
    return null;
  }
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={1}
        onPress={handleEdit}>
        {headerContent}
        {copyButton}
      </TouchableOpacity>
      <View style={styles.marked_box}>
        {reasoningSection}
        {!isEdit && (
          <TapGestureHandler
            numberOfTaps={2}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state === State.ACTIVE) {
                onDoubleTap();
              }
            }}>
            <View
              onLayout={event => {
                inputHeightRef.current = event.nativeEvent.layout.height;
              }}>
              {messageContent}
            </View>
          </TapGestureHandler>
        )}
        {isEdit && (
          <TextInput
            editable={Platform.OS === 'android'}
            multiline
            showSoftInputOnFocus={false}
            style={[
              styles.inputText,
              // eslint-disable-next-line react-native/no-inline-styles
              {
                height: inputHeightRef.current - 1,
                fontWeight: isMac ? '300' : 'normal',
                lineHeight: isMac ? 26 : Platform.OS === 'android' ? 24 : 28,
                paddingTop: Platform.OS === 'android' ? 7 : 5,
              },
            ]}>
            {currentMessage.text}
          </TextInput>
        )}
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
  copyContainer: {
    padding: 4,
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
    paddingVertical: 8,
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
});

const customMarkedStyles: MarkedStyles = {
  table: { marginVertical: 4 },
  li: { paddingVertical: 4 },
  h1: { fontSize: 28 },
  h2: { fontSize: 24 },
  h3: { fontSize: 20 },
  h4: { fontSize: 18 },
  blockquote: { marginVertical: 8 },
};

export default React.memo(CustomMessageComponent, (prevProps, nextProps) => {
  return (
    prevProps.currentMessage?.text === nextProps.currentMessage?.text &&
    prevProps.currentMessage?.image === nextProps.currentMessage?.image &&
    prevProps.currentMessage?.reasoning ===
      nextProps.currentMessage?.reasoning &&
    prevProps.chatStatus === nextProps.chatStatus
  );
});
