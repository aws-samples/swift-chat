import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { FileInfo, FileType } from '../../types/Chat.ts';
import Toast from 'react-native-toast-message';

export const saveImageToLocal = async (
  base64ImageData: string
): Promise<string> => {
  try {
    const imageName = `image_${Date.now()}.png`;
    const filePath = `${RNFS.DocumentDirectoryPath}/${imageName}`;
    await RNFS.writeFile(filePath, base64ImageData, 'base64');
    return Platform.OS === 'android' ? `file://${filePath}` : imageName;
  } catch (error) {
    console.info('Error saving image:', error);
    return '';
  }
};

export const saveFile = async (sourceUrl: string, fileName: string) => {
  try {
    const filesDir = `${RNFS.DocumentDirectoryPath}/files`;
    const filesDirExists = await RNFS.exists(filesDir);
    if (!filesDirExists) {
      await RNFS.mkdir(filesDir);
    }
    const uniqueFileName = await getUniqueFileName(filesDir, fileName);
    const destinationPath = `${filesDir}/${uniqueFileName}`;
    await RNFS.copyFile(sourceUrl, destinationPath);
    return Platform.OS === 'android'
      ? `file://${destinationPath}`
      : `files/${uniqueFileName}`;
  } catch (error) {
    console.warn('Error saving file:', error);
  }
  return null;
};

export const getFileBytes = async (fileUrl: string) => {
  try {
    const fullFileUrl = getFullFileUrl(fileUrl);
    return await RNFS.readFile(fullFileUrl, 'base64');
  } catch (error) {
    console.warn('Error reading image file:', fileUrl, error);
    throw error;
  }
};

const getUniqueFileName = async (
  basePath: string,
  originalFileName: string
): Promise<string> => {
  const lastDotIndex = originalFileName.lastIndexOf('.');
  const nameWithoutExt = originalFileName.substring(0, lastDotIndex);
  const extension = originalFileName.substring(lastDotIndex);

  let counter = 0;
  let finalFileName = originalFileName;
  let finalPath = `${basePath}/${finalFileName}`;

  while (await RNFS.exists(finalPath)) {
    counter++;
    finalFileName = `${nameWithoutExt}(${counter})${extension}`;
    finalPath = `${basePath}/${finalFileName}`;
  }
  return finalFileName;
};

export const getFullFileUrl = (url: string) => {
  if (Platform.OS === 'android') {
    return url;
  } else if (url.startsWith('files/')) {
    return `${RNFS.DocumentDirectoryPath}/${url}`;
  } else {
    return (
      RNFS.DocumentDirectoryPath +
      '/files' +
      url.substring(url.lastIndexOf('/'))
    );
  }
};

const MAX_IMAGES = 20;
const MAX_DOCUMENTS = 5;

export const checkFileNumberLimit = (
  prevFiles: FileInfo[],
  newFiles: FileInfo[]
) => {
  const existingImages = prevFiles.filter(file => file.type === FileType.image);
  const existingDocs = prevFiles.filter(
    file => file.type === FileType.document
  );
  const newImages = newFiles.filter(file => file.type === FileType.image);
  const newDocs = newFiles.filter(file => file.type === FileType.document);

  const totalImages = existingImages.length + newImages.length;
  const totalDocs = existingDocs.length + newDocs.length;

  let processedNewImages = newImages;
  let processedNewDocs = newDocs;
  let showWarning = false;

  if (totalImages > MAX_IMAGES) {
    const remainingSlots = Math.max(0, MAX_IMAGES - existingImages.length);
    processedNewImages = newImages.slice(0, remainingSlots);
    showWarning = true;
  }

  if (totalDocs > MAX_DOCUMENTS) {
    const remainingSlots = Math.max(0, MAX_DOCUMENTS - existingDocs.length);
    processedNewDocs = newDocs.slice(0, remainingSlots);
    showWarning = true;
  }

  if (showWarning) {
    if (totalImages > MAX_IMAGES) {
      Toast.show({
        type: 'info',
        text1: `Image limit exceeded, maximum ${MAX_IMAGES} images allowed`,
      });
    }
    if (totalDocs > MAX_DOCUMENTS) {
      Toast.show({
        type: 'info',
        text1: `Document limit exceeded, maximum ${MAX_DOCUMENTS} files allowed`,
      });
    }
  }
  return [...prevFiles, ...processedNewImages, ...processedNewDocs];
};
