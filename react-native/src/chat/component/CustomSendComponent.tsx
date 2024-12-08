import { IMessage, Send, SendProps } from 'react-native-gifted-chat';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChatMode, ChatStatus, FileInfo } from '../../types/Chat.ts';
import { CustomAddFileComponent } from './CustomAddFileComponent.tsx';
import { getTextModel } from '../../storage/StorageUtils.ts';

interface CustomSendComponentProps extends SendProps<IMessage> {
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
  if (
    chatMode !== ChatMode.Text ||
    !isMultiModalModel() ||
    (text && text!.length > 0) ||
    selectedFiles.length > 0 ||
    chatStatus === ChatStatus.Running
  ) {
    return (
      <Send
        {...props}
        containerStyle={styles.sendContainer}
        sendButtonProps={{
          onPress: () => {
            const { onSend } = props;
            if (onSend) {
              onSend(
                { text: text ? text.trim() : '' } as Partial<IMessage>,
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
      />
    );
  }
};

const isMultiModalModel = (): boolean => {
  const textModelId = getTextModel().modelId;
  return (
    textModelId.includes('claude-3') ||
    textModelId.includes('nova-pro') ||
    textModelId.includes('nova-lite')
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
