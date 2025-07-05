import { Send, SendProps } from 'react-native-gifted-chat';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import ImageSpinner from './ImageSpinner';
import {
  ChatMode,
  ChatStatus,
  FileInfo,
  SwiftChatMessage,
} from '../../types/Chat.ts';
import { CustomAddFileComponent } from './CustomAddFileComponent.tsx';
import { getImageModel, getTextModel } from '../../storage/StorageUtils.ts';
import { useTheme, ColorScheme } from '../../theme';

interface CustomSendComponentProps extends SendProps<SwiftChatMessage> {
  chatStatus: ChatStatus;
  chatMode: ChatMode;
  selectedFiles: FileInfo[];
  isShowLoading?: boolean;
  onStopPress: () => void;
  onFileSelected: (files: FileInfo[]) => void;
  onVoiceChatToggle?: () => void;
}

const CustomSendComponent: React.FC<CustomSendComponentProps> = ({
  chatStatus,
  chatMode,
  selectedFiles,
  isShowLoading: isShowLoading = false,
  onStopPress,
  onFileSelected,
  onVoiceChatToggle,
  ...props
}) => {
  const { text } = props;
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const isNovaSonic = getTextModel().modelId.includes('nova-sonic');
  let isShowSending = false;
  if (chatMode === ChatMode.Image) {
    isShowSending =
      !isModelSupportUploadImages(chatMode) ||
      (text && text!.length > 0) ||
      chatStatus === ChatStatus.Running;
  } else if (chatMode === ChatMode.Text) {
    isShowSending =
      ((text && text!.length > 0) ||
        selectedFiles.length > 0 ||
        chatStatus === ChatStatus.Running) &&
      !isNovaSonic &&
      !isShowLoading;
  }
  if (isShowSending) {
    return (
      <Send
        {...props}
        containerStyle={styles.sendContainer}
        sendButtonProps={{
          onPress: () => {
            const { onSend } = props;
            if (onSend) {
              onSend(
                { text: text ? text.trim() : '' } as Partial<SwiftChatMessage>,
                true
              );
            }
          },
        }}>
        <>
          {chatStatus === ChatStatus.Running && (
            <TouchableOpacity
              style={styles.stopContainer}
              onPress={() => onStopPress()}>
              <View style={styles.circle} />
              <View style={styles.rectangle} />
            </TouchableOpacity>
          )}
          {chatStatus !== ChatStatus.Running && (
            <Image
              source={
                isDark
                  ? require('../../assets/send_dark.png')
                  : require('../../assets/send.png')
              }
              style={styles.sendButton}
            />
          )}
        </>
      </Send>
    );
  } else {
    if ((isNovaSonic || isShowLoading) && chatMode === ChatMode.Text) {
      if (isShowLoading) {
        return (
          <View style={styles.loadingContainer}>
            <ImageSpinner
              source={require('../../assets/loading.png')}
              visible={true}
              size={26}
            />
          </View>
        );
      }
      return (
        <>
          {chatStatus === ChatStatus.Running && (
            <View style={styles.micContainer}>
              <TouchableOpacity
                style={styles.stopContainer}
                onPress={() => onStopPress()}>
                <View style={styles.circle} />
                <View style={styles.rectangle} />
              </TouchableOpacity>
            </View>
          )}
          {chatStatus !== ChatStatus.Running && (
            <TouchableOpacity
              style={styles.micContainer}
              onPress={onVoiceChatToggle}>
              <Image
                source={
                  isDark
                    ? require('../../assets/mic_dark.png')
                    : require('../../assets/mic.png')
                }
                style={styles.sendButton}
              />
            </TouchableOpacity>
          )}
        </>
      );
    } else {
      return (
        <CustomAddFileComponent
          {...props}
          onFileSelected={files => {
            onFileSelected(files);
          }}
          chatMode={chatMode}
        />
      );
    }
  }
};

const isModelSupportUploadImages = (chatMode: ChatMode): boolean => {
  return (
    chatMode === ChatMode.Image &&
    (getImageModel().modelId.includes('nova-canvas') ||
      getImageModel().modelId.includes('stability.sd3'))
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    stopContainer: {
      marginRight: 15,
      marginLeft: 10,
      width: 26,
      height: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    circle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.text,
      position: 'absolute',
    },
    rectangle: {
      width: 10,
      height: 10,
      backgroundColor: colors.surface,
      borderRadius: 2,
      position: 'absolute',
    },
    sendContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-end',
    },
    micContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-end',
      height: 44,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 15,
      marginLeft: 10,
      height: 44,
    },
    sendButton: {
      width: 26,
      height: 26,
      borderRadius: 15,
      marginRight: 15,
      marginLeft: 10,
    },
  });
export default CustomSendComponent;
