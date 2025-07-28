import React, { useState, useRef, useEffect } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { ChatMode, FileInfo, SystemPrompt } from '../../types/Chat.ts';
import {
  CustomFileListComponent,
  DisplayMode,
} from './CustomFileListComponent.tsx';
import { PromptListComponent } from './PromptListComponent.tsx';
import { ModelIconButton } from './ModelIconButton.tsx';
import { ModelSelectionModal } from './ModelSelectionModal.tsx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAndroid } from '../../utils/PlatformUtils.ts';

interface CustomComposerProps {
  files: FileInfo[];
  onFileUpdated: (files: FileInfo[], isUpdate?: boolean) => void;
  onSystemPromptUpdated: (prompt: SystemPrompt | null) => void;
  onSwitchedToTextModel: () => void;
  chatMode: ChatMode;
  isShowSystemPrompt: boolean;
  hasInputText?: boolean;
}

export const CustomChatFooter: React.FC<CustomComposerProps> = ({
  files,
  onFileUpdated,
  onSystemPromptUpdated,
  onSwitchedToTextModel,
  chatMode,
  isShowSystemPrompt,
  hasInputText = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [iconPosition, setIconPosition] = useState({ x: 0, y: 0 });
  const modelIconRef = useRef<View>(null);
  const iconPositionRef = useRef({ x: 0, y: 0 });
  const insets = useSafeAreaInsets();
  const statusBarHeight = useRef(insets.top);

  const handleOpenModal = () => {
    if (iconPositionRef.current.y === 0) {
      modelIconRef.current?.measure((x, y, width, height, pageX, pageY) => {
        iconPositionRef.current = {
          x: pageX,
          y: pageY + 10 + (isAndroid ? statusBarHeight.current : 0),
        };
        setIconPosition(iconPositionRef.current);
        setModalVisible(true);
      });
    } else {
      setModalVisible(true);
    }
  };
  useEffect(() => {
    Keyboard.addListener('keyboardWillShow', () => {
      modelIconRef.current?.measure((x, y, width, height, pageX, pageY) => {
        if (iconPositionRef.current.y === 0) {
          iconPositionRef.current = {
            x: pageX,
            y: pageY + 10 + (isAndroid ? statusBarHeight.current : 0),
          };
          setIconPosition(iconPositionRef.current);
        }
      });
    });
  }, []);

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  return (
    <>
      <View
        style={{
          ...styles.container,
          ...(isShowSystemPrompt &&
            files.length === 0 && {
              height: 60,
            }),
          ...(!isShowSystemPrompt &&
            files.length === 0 && {
              height: 0,
            }),
        }}>
        {files.length === 0 &&
          isShowSystemPrompt &&
          chatMode === ChatMode.Text && (
            <View style={styles.promptContainer}>
              <PromptListComponent
                onSelectPrompt={prompt => {
                  onSystemPromptUpdated(prompt);
                }}
                onSwitchedToTextModel={() => {
                  onSwitchedToTextModel();
                }}
              />
              <View ref={modelIconRef} collapsable={false}>
                <ModelIconButton onPress={handleOpenModal} />
              </View>
            </View>
          )}
        {(hasInputText || files.length > 0) && (
          <CustomFileListComponent
            files={files}
            onFileUpdated={onFileUpdated}
            mode={
              chatMode === ChatMode.Image
                ? DisplayMode.GenImage
                : DisplayMode.Edit
            }
            hasInputText={hasInputText}
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
