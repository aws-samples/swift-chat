import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FileInfo } from '../../types/Chat.ts';
import { CustomFileListComponent } from './CustomFileListComponent.tsx';

interface CustomComposerProps {
  files: FileInfo[];
  onFileUpdated: (files: FileInfo[], isUpdate?: boolean) => void;
}

export const CustomChatFooter: React.FC<CustomComposerProps> = ({
  files,
  onFileUpdated,
}) => {
  return (
    <View style={styles.container}>
      {files.length > 0 && (
        <CustomFileListComponent files={files} onFileUpdated={onFileUpdated} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 90,
  },
});
