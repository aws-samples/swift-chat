import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FileInfo, FileType } from '../../types/Chat.ts';
import { CustomAddFileComponent } from './CustomAddFileComponent.tsx';
import ImageView from 'react-native-image-viewing';
import { ImageSource } from 'react-native-image-viewing/dist/@types';
import Share from 'react-native-share';
import FileViewer from 'react-native-file-viewer';
import { isMac } from '../../App.tsx';
import { getFullFileUrl } from '../util/FileUtils.ts';

interface CustomFileProps {
  files: FileInfo[];
  onFileSelected?: (files: FileInfo[], isDelete?: boolean) => void;
  mode?: DisplayMode;
}

export enum DisplayMode {
  Edit = 'edit',
  Display = 'display',
}

const openInFileViewer = (url: string) => {
  FileViewer.open(url)
    .then(() => {})
    .catch(error => {
      console.log(error);
    });
};

export const CustomFileListComponent: React.FC<CustomFileProps> = ({
  files,
  onFileSelected,
  mode = DisplayMode.Edit,
}) => {
  const [visible, setIsVisible] = useState(false);
  const [index, setIndex] = useState<number>(0);
  const [imageUrls, setImageUrls] = useState<ImageSource[]>([]);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollViewRef.current && mode !== DisplayMode.Display) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [files, mode]);

  const renderFileItem = (file: FileInfo, fileIndex: number) => {
    const isImage = file.type === FileType.image;
    const fullFileUrl = getFullFileUrl(file.url);
    const itemKey = `file-${fileIndex}-${file.url}`;
    return (
      <View
        key={itemKey}
        style={{
          ...styles.fileItem,
          ...(!isImage && {
            width: 158,
          }),
        }}>
        {mode === DisplayMode.Edit && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              const newFiles = files.filter(f => f.url !== file.url);
              onFileSelected!(newFiles, true);
            }}>
            <Text style={styles.deleteIcon}>×</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onLongPress={() => {
            try {
              const options = {
                type: 'text/plain',
                url: fullFileUrl,
                showAppsToView: true,
              };
              Share.open(options).then();
            } catch (error) {
              console.log('Error opening file:', error);
            }
          }}
          onPress={() => {
            if (isMac || file.type === FileType.document) {
              openInFileViewer(fullFileUrl);
            } else {
              const images = files
                .filter(item => item.type === FileType.image)
                .map(item => ({ uri: getFullFileUrl(item.url) }));
              const currentIndex = images.findIndex(
                img => img.uri === fullFileUrl
              );
              setImageUrls(images);
              setIndex(currentIndex);
              setIsVisible(true);
            }
          }}>
          {isImage ? (
            <Image
              source={{ uri: fullFileUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.filePreview}>
              <Text numberOfLines={2} style={styles.fileName}>
                {file.fileName}
              </Text>
              <View style={styles.formatContainer}>
                <Image
                  source={require('./../../assets/document.png')}
                  style={styles.formatIcon}
                />
                <Text style={styles.fileFormat}>
                  {file.format.toUpperCase()}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView
      horizontal
      ref={scrollViewRef}
      contentContainerStyle={{
        ...styles.containerStyle,
        ...(mode === DisplayMode.Display && {
          paddingHorizontal: 0,
        }),
      }}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={{
        ...styles.scrollView,
        ...(mode === DisplayMode.Display && {
          marginLeft: 0,
          paddingTop: 4,
        }),
      }}>
      {files.map((file, fileIndex) => renderFileItem(file, fileIndex))}

      {mode === DisplayMode.Edit && (
        <TouchableOpacity key="add-button" style={styles.addButton}>
          <CustomAddFileComponent
            onFileSelected={onFileSelected!}
            mode="list"
          />
        </TouchableOpacity>
      )}
      <ImageView
        images={imageUrls}
        imageIndex={index}
        visible={visible}
        onRequestClose={() => setIsVisible(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    paddingVertical: 8,
    backgroundColor: 'white',
  },
  containerStyle: {
    paddingHorizontal: 12,
  },
  fileItem: {
    width: 72,
    height: 72,
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
    width: 20,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    marginTop: 2,
    marginRight: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    color: '#fff',
    fontSize: 16,
    marginTop: -1.5,
    marginLeft: 0.6,
    fontWeight: 'normal',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  filePreview: {
    width: '100%',
    height: '100%',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 8,
  },
  formatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formatIcon: {
    width: 16,
    height: 16,
    marginRight: 4,
  },
  fileName: {
    fontSize: 12,
    color: '#333',
    paddingRight: 12,
  },
  fileFormat: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    width: 72,
    height: 72,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
