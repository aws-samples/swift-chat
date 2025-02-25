import { Send, SendProps } from 'react-native-gifted-chat';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  ChatMode,
  ChatStatus,
  FileInfo,
  SwiftChatMessage,
} from '../../types/Chat.ts';
import { CustomAddFileComponent } from './CustomAddFileComponent.tsx';
import { getImageModel, getTextModel } from '../../storage/StorageUtils.ts';

interface CustomSendComponentProps extends SendProps<SwiftChatMessage> {
  chatStatus: ChatStatus;
  chatMode: ChatMode;
  selectedFiles: FileInfo[];
  onStopPress: () => void;
  onFileSelected: (files: FileInfo[]) => void;
}

const CustomSendComponent: React.FC<CustomSendComponentProps> = ({
  chatStatus,
  chatMode,
  selectedFiles,
  onStopPress,
  onFileSelected,
  ...props
}) => {
  const { text } = props;
  let isShowSending = false;
  if (chatMode === ChatMode.Image) {
    isShowSending =
      !isModelSupportUploadImages(chatMode) ||
      (text && text!.length > 0) ||
      chatStatus === ChatStatus.Running;
  } else if (chatMode === ChatMode.Text) {
    isShowSending =
      !isMultiModalModel() ||
      (text && text!.length > 0) ||
      selectedFiles.length > 0 ||
      chatStatus === ChatStatus.Running;
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
              source={require('../../assets/send.png')}
              style={styles.sendButton}
            />
          )}
        </>
      </Send>
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
};

const isMultiModalModel = (): boolean => {
  const textModelId = getTextModel().modelId;
  return (
    textModelId.includes('claude-3') ||
    textModelId.includes('nova-pro') ||
    textModelId.includes('nova-lite') ||
    textModelId.startsWith('ollama') ||
    textModelId.startsWith('gpt') ||
    textModelId.startsWith('deepseek')
  );
};

const isModelSupportUploadImages = (chatMode: ChatMode): boolean => {
  return (
    chatMode === ChatMode.Image &&
    (getImageModel().modelId.includes('nova-canvas') ||
      getImageModel().modelId.includes('stability.sd3'))
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: 'black',
    position: 'absolute',
  },
  rectangle: {
    width: 10,
    height: 10,
    backgroundColor: 'white',
    borderRadius: 2,
    position: 'absolute',
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
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
