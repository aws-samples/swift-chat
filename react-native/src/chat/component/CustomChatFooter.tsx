import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChatMode, FileInfo, SystemPrompt } from '../../types/Chat.ts';
import {
  CustomFileListComponent,
  DisplayMode,
} from './CustomFileListComponent.tsx';
import { PromptListComponent } from './PromptListComponent.tsx';

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
  if (files.length > 0 || (isShowSystemPrompt && chatMode === ChatMode.Text)) {
    return (
      <View
        style={{
          ...styles.container,
          ...(isShowSystemPrompt && {
            height: 60,
          }),
        }}>
        {isShowSystemPrompt && (
          <PromptListComponent
            onSelectPrompt={prompt => {
              onSystemPromptUpdated(prompt);
            }}
          />
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
    );
  } else {
    return null;
  }
};

const styles = StyleSheet.create({
  container: {
    height: 90,
  },
});
