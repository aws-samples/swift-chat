import { Actions } from 'react-native-gifted-chat';
import { Image, Platform, StyleSheet, Text } from 'react-native';
import React, { useRef } from 'react';
import {
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { ChatMode, FileInfo, FileType } from '../../types/Chat.ts';
import { pick, types } from 'react-native-document-picker';
import { saveFile } from '../util/FileUtils.ts';
import {
  createVideoThumbnail,
  getImageMetaData,
  getVideoMetaData,
  Image as Img,
} from 'react-native-compressor';
import { isMac } from '../../App.tsx';
import { getTextModel } from '../../storage/StorageUtils.ts';
import { showInfo } from '../util/ToastUtils.ts';
import { useTheme } from '../../theme';
import { isAndroid } from '../../utils/PlatformUtils.ts';

interface CustomRenderActionsProps {
  onFileSelected: (files: FileInfo[]) => void;
  mode?: 'default' | 'list';
  chatMode?: ChatMode;
}

const DefaultIcon = () => {
  const { isDark } = useTheme();
  return (
    <Image
      style={styles.imageButton}
      resizeMode="contain"
      source={
        isDark
          ? require('../../assets/add_dark.png')
          : require('../../assets/add.png')
      }
    />
  );
};

const ListIcon = ({ textColor }: { textColor: string }) => (
  <Text style={[styles.addIcon, { color: textColor }]}>+</Text>
);

export const CustomAddFileComponent: React.FC<CustomRenderActionsProps> = ({
  onFileSelected,
  mode = 'default',
  chatMode = ChatMode.Text,
}) => {
  const { colors } = useTheme();
  const chatModeRef = useRef(chatMode);

  // Create a memoized ListIcon component with theme colors
  const ThemedListIcon = React.useCallback(
    () => <ListIcon textColor={colors.textSecondary} />,
    [colors.textSecondary]
  );
  chatModeRef.current = chatMode;
  const handleChooseFiles = async () => {
    let chooseType = [];
    const isImageMode = chatModeRef.current === ChatMode.Image;
    try {
      if (isImageMode) {
        chooseType = [types.images];
      } else {
        chooseType = [types.allFiles];
      }
      const pickResults = await pick({
        allowMultiSelection: !isImageMode,
        type: chooseType,
      });
      const files: FileInfo[] = [];
      await Promise.all(
        pickResults.map(async pickResult => {
          if (pickResult.name && pickResult.uri) {
            const fileName = getFileNameWithoutExtension(pickResult.name);
            const fileNameArr = pickResult.name.split('.');
            let format = fileNameArr[fileNameArr.length - 1].toLowerCase();
            const fileType = getFileType(format);
            if (fileType === FileType.unSupported) {
              const msg = 'Selected UnSupported Files format: .' + format;
              showInfo(msg);
              return;
            }
            if (
              fileType === FileType.document &&
              (pickResult.size ?? 0) >= MAX_FILE_SIZE
            ) {
              const msg = 'File size exceeds 4.5MB limit: ' + pickResult.name;
              showInfo(msg);
              return;
            }
            let localFileUrl: string | null;
            let width = 0;
            let height = 0;
            if (fileType === FileType.image) {
              pickResult.uri = decodeURI(pickResult.uri);
              if (format === 'png' || format === 'jpg' || format === 'jpeg') {
                pickResult.uri = await Img.compress(pickResult.uri);
                const metaData = await getImageMetaData(pickResult.uri);
                format = metaData.extension;
                width = metaData.ImageWidth;
                height = metaData.ImageHeight;
              }
              localFileUrl = await saveFile(pickResult.uri, pickResult.name);
            } else if (fileType === FileType.video) {
              localFileUrl = pickResult.uri;
            } else {
              localFileUrl = await saveFile(
                decodeURI(pickResult.uri),
                pickResult.name
              );
            }

            let thumbnailUrl;
            if (fileType === FileType.video) {
              if (Platform.OS === 'android') {
                localFileUrl = await saveFile(pickResult.uri, fileName);
                pickResult.uri = localFileUrl!;
              }
              const thumbnail = await createVideoThumbnail(pickResult.uri);
              thumbnailUrl =
                (await saveFile(thumbnail.path, fileName + '.jpeg')) ?? '';
              const metaData = await getVideoMetaData(pickResult.uri);
              width = metaData.width;
              height = metaData.height;
            }

            if (localFileUrl) {
              files.push({
                fileName: fileName,
                url: localFileUrl,
                videoThumbnailUrl: thumbnailUrl,
                fileSize: pickResult.size ?? 0,
                type: fileType,
                format: format.toLowerCase() === 'jpg' ? 'jpeg' : format,
                width: width,
                height: height,
              });
            }
          }
        }) ?? []
      );
      if (files.length > 0) {
        onFileSelected(files);
      }
    } catch (err: unknown) {
      console.info(err);
    }
  };

  if (isMac) {
    return (
      <Actions
        containerStyle={{
          ...styles.containerStyle,
          ...(mode === 'list' && {
            width: '100%',
            height: '100%',
            marginRight: 10,
          }),
        }}
        icon={mode === 'default' ? DefaultIcon : ThemedListIcon}
        onPressActionButton={handleChooseFiles}
      />
    );
  }
  return (
    <Actions
      containerStyle={{
        ...styles.containerStyle,
        ...(mode === 'list' && {
          width: '100%',
          height: '100%',
          marginRight: 10,
        }),
      }}
      icon={mode === 'default' ? DefaultIcon : ThemedListIcon}
      options={{
        'Take Camera': () => {
          launchCamera({
            saveToPhotos: false,
            mediaType:
              chatModeRef.current === ChatMode.Text && isVideoSupported()
                ? 'mixed'
                : 'photo',
            videoQuality: 'high',
            durationLimit: 30,
            includeBase64: false,
            includeExtra: true,
            presentationStyle: 'fullScreen',
          }).then(async res => {
            const files = await getFiles(res);
            if (files.length > 0) {
              onFileSelected(files);
            }
          });
        },
        'Choose From Photos': () => {
          launchImageLibrary({
            selectionLimit: chatModeRef.current === ChatMode.Text ? 0 : 1,
            mediaType:
              chatModeRef.current === ChatMode.Text && isVideoSupported()
                ? 'mixed'
                : 'photo',
            includeBase64: false,
            includeExtra: true,
            assetRepresentationMode: 'current',
          }).then(async res => {
            const files = await getFiles(res);
            if (files.length > 0) {
              onFileSelected(files);
            }
          });
        },
        'Choose From Files': handleChooseFiles,
        Cancel: () => {},
      }}
      optionTintColor={isAndroid ? colors.background : colors.text}
    />
  );
};

const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
export const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
export const VIDEO_FORMATS = ['mp4', 'mov', 'mkv', 'webm'];
export const EXTRA_DOCUMENT_FORMATS = [
  'json',
  'py',
  'ts',
  'tsx',
  'js',
  'kt',
  'java',
  'swift',
  'c',
  'm',
  'h',
  'sh',
  'cpp',
  'rs',
  'go',
  'class',
  'cs',
  'php',
  'rb',
  'dart',
  'sql',
  'css',
  'xml',
  'yaml',
];
export const DOCUMENT_FORMATS = [
  'pdf',
  'csv',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'html',
  'txt',
  'md',
  ...EXTRA_DOCUMENT_FORMATS,
];

export const getFileType = (format: string) => {
  if (isImageFormat(format)) {
    return FileType.image;
  } else if (isVideoFormat(format)) {
    return FileType.video;
  } else if (isDocumentFormat(format)) {
    return FileType.document;
  } else {
    return FileType.unSupported;
  }
};

export const isImageFormat = (format: string) => {
  return IMAGE_FORMATS.includes(format);
};

export const isVideoFormat = (format: string) => {
  return VIDEO_FORMATS.includes(format);
};

export const isDocumentFormat = (format: string) => {
  return DOCUMENT_FORMATS.includes(format);
};

const getFileNameWithoutExtension = (fileName: string) => {
  return fileName.substring(0, fileName.lastIndexOf('.')).trim();
};

export const isVideoSupported = (): boolean => {
  const textModelId = getTextModel().modelId;
  return textModelId.includes('nova-pro') || textModelId.includes('nova-lite');
};

const getFiles = async (res: ImagePickerResponse) => {
  const files: FileInfo[] = [];
  await Promise.all(
    res.assets?.map(async media => {
      if (media.fileName && media.uri) {
        const fileName = getFileNameWithoutExtension(media.fileName);
        const fileNameArr = media.fileName.split('.');
        let format = fileNameArr[fileNameArr.length - 1].toLowerCase();
        const fileType = getFileType(format);
        if (fileType === FileType.unSupported) {
          const msg = 'Selected UnSupported Files format: .' + format;
          showInfo(msg);
          return;
        }
        let width = media.width;
        let height = media.height;
        if (format === 'png' || format === 'jpg' || format === 'jpeg') {
          media.uri = await Img.compress(media.uri);
          const metaData = await getImageMetaData(media.uri);
          format = metaData.extension;
          width = metaData.ImageWidth;
          height = metaData.ImageHeight;
        }
        let thumbnailUrl;
        if (fileType === FileType.video) {
          const thumbnail = await createVideoThumbnail(media.uri);
          thumbnailUrl =
            (await saveFile(thumbnail.path, fileName + '.jpeg')) ?? '';
        }
        let localFileUrl: string | null;
        if (fileType !== FileType.video) {
          localFileUrl = await saveFile(media.uri, media.fileName);
        } else {
          localFileUrl = media.uri;
        }

        if (localFileUrl) {
          files.push({
            fileName: fileName,
            url: localFileUrl,
            videoThumbnailUrl: thumbnailUrl,
            fileSize: media.fileSize ?? 0,
            type: fileType,
            format: format === 'jpg' ? 'jpeg' : format,
            width: width,
            height: height,
          });
        }
      }
    }) ?? []
  );
  return files;
};

const styles = StyleSheet.create({
  containerStyle: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    marginRight: 6,
    marginLeft: 10,
  },
  listContainerStyle: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    marginRight: 6,
    marginLeft: 10,
  },
  imageButton: {
    width: 26,
    height: 26,
  },
  addIcon: {
    fontSize: 24,
    color: '#666',
  },
});
