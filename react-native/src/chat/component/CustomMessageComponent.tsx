import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Text, Image, TouchableOpacity } from 'react-native';
import Share from 'react-native-share';
import Markdown from 'react-native-marked';
import { IMessage, MessageProps } from 'react-native-gifted-chat';
import { CustomMarkdownRenderer } from './CustomMarkdownRenderer.tsx';
import { MarkedStyles } from 'react-native-marked/src/theme/types.ts';
import ImageView from 'react-native-image-viewing';
import { PressMode } from '../../types/Chat.ts';
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

const CustomMessageComponent: React.FC<MessageProps<IMessage>> = ({
  currentMessage,
}) => {
  const [visible, setIsVisible] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const [copied, setCopied] = useState(false);
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
    Clipboard.setString(currentMessage?.text ?? '');
    setCopied(true);
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
        onPress={handleCopy}>
        <Image source={imgSource} style={styles.avatar} />
        <Text style={styles.name}>{userName}</Text>
        <Image
          source={
            copied
              ? require('../../assets/done.png')
              : require('../../assets/copy_grey.png')
          }
          style={styles.copy}
        />
      </TouchableOpacity>
      <View style={styles.marked_box}>
        <Markdown
          value={currentMessage.text}
          flatListProps={{
            initialNumToRender: 8,
          }}
          styles={customMarkedStyles}
          renderer={customMarkdownRenderer}
          tokenizer={customTokenizer}
        />
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
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
  },
});

const customMarkedStyles: MarkedStyles = {
  table: { marginVertical: 4 },
  li: { paddingVertical: 4 },
};

export default CustomMessageComponent;
