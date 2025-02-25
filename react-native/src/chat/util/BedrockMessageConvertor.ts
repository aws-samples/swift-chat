import { FileInfo, FileType, SwiftChatMessage } from '../../types/Chat.ts';
import { getFileBytes } from './FileUtils.ts';

export async function getBedrockMessagesFromChatMessages(
  messages: SwiftChatMessage[]
): Promise<BedrockMessage[]> {
  const bedrockMessages: BedrockMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = await getBedrockMessage(messages[i]);
    bedrockMessages.push(msg);
  }
  return bedrockMessages;
}

export async function getBedrockMessage(
  message: SwiftChatMessage
): Promise<BedrockMessage> {
  const content: MessageContent[] = [{ text: message.text }];
  if (message.image) {
    const files = JSON.parse(message.image) as FileInfo[];
    for (const file of files) {
      try {
        const fileUrl =
          file.type === FileType.video ? file.videoUrl! : file.url;
        const fileBytes = await getFileBytes(fileUrl);
        if (file.type === FileType.image) {
          content.push({
            image: {
              format: file.format.toLowerCase(),
              source: {
                bytes: fileBytes,
              },
            },
          });
        } else if (file.type === FileType.video) {
          content.push({
            video: {
              format: file.format.toLowerCase(),
              source: {
                bytes: fileBytes,
              },
            },
          });
        } else if (file.type === FileType.document) {
          let fileName = file.fileName;
          if (!isValidFilename(fileName)) {
            fileName = normalizeFilename(fileName);
          }
          content.push({
            document: {
              format: file.format.toLowerCase(),
              name: fileName + '_' + new Date().getTime(),
              source: {
                bytes: fileBytes,
              },
            },
          });
        }
      } catch (error) {
        console.warn(`Error processing file ${file.fileName}:`, error);
      }
    }
  }
  return {
    role: message.user._id === 1 ? 'user' : 'assistant',
    content: content,
  };
}

function normalizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9\s\-()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidFilename(filename: string): boolean {
  const validCharPattern = /^[a-zA-Z0-9\s\-()[\]]+$/;
  const consecutiveSpacesPattern = /\s{2,}/;
  if (!filename || filename.trim() === '') {
    return false;
  }
  return (
    validCharPattern.test(filename) && !consecutiveSpacesPattern.test(filename)
  );
}

export interface TextContent {
  text: string;
}

export interface ImageContent {
  image: ImageInfo;
}

export interface ImageInfo {
  format: string;
  source: {
    bytes: string;
  };
}

export interface VideoContent {
  video: {
    format: string;
    source: {
      bytes: string;
    };
  };
}

export interface DocumentContent {
  document: {
    format: string;
    name: string;
    source: {
      bytes: string;
    };
  };
}

export type MessageContent =
  | TextContent
  | ImageContent
  | VideoContent
  | DocumentContent;

export type BedrockMessage = {
  role: string;
  content: MessageContent[];
};

export type OpenAIMessage = {
  role: string;
  content:
    | string
    | Array<{
        type: 'text' | 'image_url';
        text?: string;
        image_url?: {
          url: string;
        };
      }>;
};
