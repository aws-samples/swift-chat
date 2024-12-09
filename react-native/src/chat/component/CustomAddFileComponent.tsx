import { Actions } from 'react-native-gifted-chat';
import { Image, Platform, StyleSheet, Text } from 'react-native';
import React from 'react';
import {
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { FileInfo, FileType } from '../../types/Chat.ts';
import { pick, types } from 'react-native-document-picker';
import Toast from 'react-native-toast-message';
import { saveFile } from '../util/FileUtils.ts';
import {
  createVideoThumbnail,
  getImageMetaData,
  getVideoMetaData,
  Image as Img,
} from 'react-native-compressor';
import { isMac } from '../../App.tsx';
import { getTextModel } from '../../storage/StorageUtils.ts';

interface CustomRenderActionsProps {
  onFileSelected: (files: FileInfo[]) => void;
  mode?: 'default' | 'list';
}

const DefaultIcon = () => (
  <Image
    style={styles.imageButton}
    resizeMode="contain"
    source={require('../../assets/add.png')}
  />
);

const ListIcon = () => <Text style={styles.addIcon}>+</Text>;
export const CustomAddFileComponent: React.FC<CustomRenderActionsProps> = ({
  onFileSelected,
  mode = 'default',
}) => {
  const handleChooseFiles = async () => {
    try {
      const chooseType = [
        types.images,
        types.pdf,
        types.csv,
        types.doc,
        types.docx,
        types.xls,
        types.xlsx,
        types.plainText,
        'public.html',
      ];
      if (isVideoSupported()) {
        chooseType.push(types.video);
      }
      const pickResults = await pick({
        allowMultiSelection: true,
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
            if (fileType === FileType.image) {
              pickResult.uri = decodeURI(pickResult.uri);
              if (format === 'png' || format === 'jpg' || format === 'jpeg') {
                pickResult.uri = await Img.compress(pickResult.uri);
                const metaData = await getImageMetaData(pickResult.uri);
                format = metaData.extension;
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
            let width = 0;
            let height = 0;
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
        icon={mode === 'default' ? DefaultIcon : ListIcon}
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
      icon={mode === 'default' ? DefaultIcon : ListIcon}
      options={{
        'Take Camera': () => {
          launchCamera({
            saveToPhotos: false,
            mediaType: isVideoSupported() ? 'mixed' : 'photo',
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
            selectionLimit: 0,
            mediaType: isVideoSupported() ? 'mixed' : 'photo',
            includeBase64: false,
            includeExtra: true,
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
      optionTintColor="black"
    />
  );
};

const showInfo = (msg: string) => {
  Toast.show({
    type: 'info',
    text1: msg,
  });
};

const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
export const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
export const VIDEO_FORMATS = ['mp4', 'mov', 'mkv', 'webm'];
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
        if (format === 'png' || format === 'jpg' || format === 'jpeg') {
          media.uri = await Img.compress(media.uri);
          const metaData = await getImageMetaData(media.uri);
          format = metaData.extension;
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
            width: media.width,
            height: media.height,
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
