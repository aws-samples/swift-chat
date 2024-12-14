import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChatMode, FileInfo } from '../../types/Chat.ts';
import {
  CustomFileListComponent,
  DisplayMode,
} from './CustomFileListComponent.tsx';

interface CustomComposerProps {
  files: FileInfo[];
  onFileUpdated: (files: FileInfo[], isUpdate?: boolean) => void;
  chatMode: ChatMode;
}

export const CustomChatFooter: React.FC<CustomComposerProps> = ({
  files,
  onFileUpdated,
  chatMode,
}) => {
  return (
    <View style={styles.container}>
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
};

const styles = StyleSheet.create({
  container: {
    height: 90,
  },
});
