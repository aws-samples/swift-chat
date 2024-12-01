import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import Share from 'react-native-share';
import Markdown from 'react-native-marked';
import { IMessage, MessageProps } from 'react-native-gifted-chat';
import { CustomMarkdownRenderer } from './CustomMarkdownRenderer.tsx';
import { MarkedStyles } from 'react-native-marked/src/theme/types.ts';
import ImageView from 'react-native-image-viewing';
import { ChatStatus, PressMode } from '../../types/Chat.ts';
import { trigger } from '../util/HapticUtils.ts';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types.ts';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  CustomFileListComponent,
  DisplayMode,
} from './CustomFileListComponent.tsx';
import FileViewer from 'react-native-file-viewer';
import { isMac } from '../../App.tsx';
import { CustomTokenizer } from './CustomTokenizer.ts';
import { State, TapGestureHandler } from 'react-native-gesture-handler';

interface CustomMessageProps extends MessageProps<IMessage> {
  chatStatus: ChatStatus;
}

const CustomMessageComponent: React.FC<CustomMessageProps> = ({
  currentMessage,
  chatStatus,
}) => {
  const [visible, setIsVisible] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const inputHeightRef = useRef(0);
  const userName =
    currentMessage?.user._id === 1
      ? 'You'
      : currentMessage?.user.name ?? 'Bedrock';

  const imgSource =
    currentMessage?.user._id === 1
      ? require('../../assets/user.png')
      : require('../../assets/bedrock.png');

  const handleImagePress = useCallback((pressMode: PressMode, url: string) => {
    if (pressMode === PressMode.Click) {
      if (isMac) {
        FileViewer.open(url)
          .then(() => {})
          .catch(error => {
            console.log(error);
          });
      } else {
        setIsVisible(true);
        setImgUrl(url);
      }
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
  const handleCopy = () => {
    if (isEdit) {
      setIsEditValue(false);
      return;
    }
    Clipboard.setString(currentMessage?.text ?? '');
    setCopied(true);
  };

  const handleEdit = () => {
    setIsEditValue(!isEdit);
  };

  const onDoubleTap = () => {
    setIsEditValue(true);
  };

  const setIsEditValue = (value: boolean) => {
    if (chatStatus !== ChatStatus.Running) {
      setIsEdit(value);
    }
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [copied]);

  if (!currentMessage) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={1}
        onPress={handleEdit}>
        <Image source={imgSource} style={styles.avatar} />
        <Text style={styles.name}>{userName}</Text>
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
      </TouchableOpacity>
      <View style={styles.marked_box}>
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
              <Markdown
                value={currentMessage.text}
                flatListProps={{
                  initialNumToRender: 8,
                }}
                styles={customMarkedStyles}
                renderer={customMarkdownRenderer}
                tokenizer={customTokenizer}
              />
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
      <ImageView
        images={[{ uri: imgUrl }]}
        imageIndex={0}
        visible={visible}
        onRequestClose={() => setIsVisible(false)}
      />
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
  inputText: {
    fontSize: 16,
    lineHeight: 26,
    textAlignVertical: 'top',
    marginTop: 1,
    padding: 0,
    fontWeight: '300',
    color: '#333333',
    letterSpacing: 0,
  },
});

const customMarkedStyles: MarkedStyles = {
  table: { marginVertical: 4 },
  li: { paddingVertical: 4 },
};

export default CustomMessageComponent;
