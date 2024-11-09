import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FileInfo } from '../../types/Chat.ts';
import { CustomFileListComponent } from './CustomFileListComponent.tsx';

interface CustomComposerProps {
  files: FileInfo[];
  onFileSelected: (files: FileInfo[], isDelete?: boolean) => void;
}

export const CustomChatFooter: React.FC<CustomComposerProps> = ({
  files,
  onFileSelected,
}) => {
  return (
    <View style={styles.container}>
      {files.length > 0 && (
        <CustomFileListComponent
          files={files}
          onFileSelected={onFileSelected}
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
