import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { ChatMode, FileInfo, SystemPrompt } from '../../types/Chat.ts';
import {
  CustomFileListComponent,
  DisplayMode,
} from './CustomFileListComponent.tsx';
import { PromptListComponent } from './PromptListComponent.tsx';
import { ModelIconButton } from './ModelIconButton.tsx';
import { ModelSelectionModal } from './ModelSelectionModal.tsx';

interface CustomComposerProps {
  files: FileInfo[];
  onFileUpdated: (files: FileInfo[], isUpdate?: boolean) => void;
  onSystemPromptUpdated: (prompt: SystemPrompt | null) => void;
  chatMode: ChatMode;
  isShowSystemPrompt: boolean;
}

export const CustomChatFooter: React.FC<CustomComposerProps> = ({
  files,
  onFileUpdated,
  onSystemPromptUpdated,
  chatMode,
  isShowSystemPrompt,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [iconPosition, setIconPosition] = useState({ x: 0, y: 0 });
  const modelIconRef = useRef<View>(null);
  const iconPositionRef = useRef({ x: 0, y: 0 });
  const handleOpenModal = () => {
    modelIconRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setModalVisible(true);
    });
  };
  useEffect(() => {
    Keyboard.addListener('keyboardWillShow', () => {
      modelIconRef.current?.measure((x, y, width, height, pageX, pageY) => {
        if (iconPositionRef.current.y === 0) {
          iconPositionRef.current = { x: pageX, y: pageY + 10 };
          setIconPosition(iconPositionRef.current);
        }
      });
    });
  }, []);

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  if (files.length > 0 || (isShowSystemPrompt && chatMode === ChatMode.Text)) {
    return (
      <>
        <View
          style={{
            ...styles.container,
            ...(isShowSystemPrompt && {
              height: 60,
            }),
          }}>
          {isShowSystemPrompt && chatMode === ChatMode.Text && (
            <View style={styles.promptContainer}>
              <PromptListComponent
                onSelectPrompt={prompt => {
                  onSystemPromptUpdated(prompt);
                }}
              />
              <View ref={modelIconRef} collapsable={false}>
                <ModelIconButton onPress={handleOpenModal} />
              </View>
            </View>
          )}
          {files.length > 0 && (
            <CustomFileListComponent
              files={files}
              onFileUpdated={onFileUpdated}
              mode={
                chatMode === ChatMode.Image
                  ? DisplayMode.GenImage
                  : DisplayMode.Edit
              }
            />
          )}
        </View>
        <ModelSelectionModal
          visible={modalVisible}
          onClose={handleCloseModal}
          iconPosition={iconPosition}
        />
      </>
    );
  } else {
    return null;
  }
};

const styles = StyleSheet.create({
  container: {
    height: 90,
  },
  promptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
});
