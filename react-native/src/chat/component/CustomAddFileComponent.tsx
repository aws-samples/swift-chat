import { Actions } from 'react-native-gifted-chat';
import { Image, StyleSheet, Text } from 'react-native';
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
import { Image as Img } from 'react-native-compressor';
import { isMac } from '../../App.tsx';

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
      const pickResults = await pick({
        allowMultiSelection: true,
        type: [
          types.images,
          types.pdf,
          types.csv,
          types.doc,
          types.docx,
          types.xls,
          types.xlsx,
          types.plainText,
          'public.html',
        ],
      });
      const files: FileInfo[] = [];
      await Promise.all(
        pickResults.map(async pickResult => {
          if (pickResult.name && pickResult.uri) {
            const fileName = getFileNameWithoutExtension(pickResult.name);
            const fileNameArr = pickResult.name.split('.');
            const format = fileNameArr[fileNameArr.length - 1];
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
              const compressUri = await Img.compress(decodeURI(pickResult.uri));
              localFileUrl = await saveFile(compressUri, pickResult.name);
            } else {
              localFileUrl = await saveFile(
                decodeURI(pickResult.uri),
                pickResult.name
              );
            }
            if (localFileUrl) {
              files.push({
                fileName: fileName,
                url: localFileUrl,
                fileSize: pickResult.size ?? 0,
                type: fileType,
                format: format.toLowerCase() === 'jpg' ? 'jpeg' : format,
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
            mediaType: 'photo',
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
            mediaType: 'photo',
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
  } else if (isDocumentFormat(format)) {
    return FileType.document;
  } else {
    return FileType.unSupported;
  }
};

export const isImageFormat = (format: string) => {
  return IMAGE_FORMATS.includes(format.toLowerCase());
};

export const isDocumentFormat = (format: string) => {
  return DOCUMENT_FORMATS.includes(format.toLowerCase());
};

const getFileNameWithoutExtension = (fileName: string) => {
  return fileName.substring(0, fileName.lastIndexOf('.')).trim();
};

const getFiles = async (res: ImagePickerResponse) => {
  const files: FileInfo[] = [];
  await Promise.all(
    res.assets?.map(async image => {
      if (image.fileName && image.uri) {
        const fileName = getFileNameWithoutExtension(image.fileName);
        const fileNameArr = image.fileName.split('.');
        const format = fileNameArr[fileNameArr.length - 1];
        const fileType = getFileType(format);
        if (fileType === FileType.unSupported) {
          const msg = 'Selected UnSupported Files format: .' + format;
          showInfo(msg);
          return;
        }
        const compressUri = await Img.compress(image.uri);
        const localFileUrl = await saveFile(compressUri, image.fileName);
        if (localFileUrl) {
          files.push({
            fileName: fileName,
            url: localFileUrl,
            fileSize: image.fileSize ?? 0,
            type: fileType,
            format: format.toLowerCase() === 'jpg' ? 'jpeg' : format,
            width: image.width,
            height: image.height,
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
