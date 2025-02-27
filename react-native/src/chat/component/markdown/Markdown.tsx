import React, {
  memo,
  useCallback,
  type ReactElement,
  type ReactNode,
} from 'react';
import { FlatList, useColorScheme } from 'react-native';
import { MarkdownProps } from 'react-native-marked';
import useMarkdown from './useMarkdown.ts';
import { ChatStatus } from '../../../types/Chat.ts';

type ChatMarkdownProps = MarkdownProps & {
  chatStatus: ChatStatus;
};

const Markdown = ({
  value,
  flatListProps,
  theme,
  baseUrl,
  renderer,
  styles,
  tokenizer,
  chatStatus,
}: ChatMarkdownProps) => {
  const colorScheme = useColorScheme();

  const rnElements = useMarkdown(value, {
    theme,
    baseUrl,
    renderer,
    colorScheme,
    styles,
    tokenizer,
    chatStatus,
  });

  const renderItem = useCallback(({ item }: { item: ReactNode }) => {
    return item as ReactElement;
  }, []);

  const keyExtractor = useCallback(
    (_: ReactNode, index: number) => index.toString(),
    []
  );

  const contentSize = Math.floor(rnElements.length / 100) + 1;
  const initNum = 20 * contentSize;
  const maxBatch = 20 * contentSize;
  const windowSize = 20 * contentSize + 1;
  return (
    <FlatList
      removeClippedSubviews={false}
      keyExtractor={keyExtractor}
      maxToRenderPerBatch={maxBatch}
      initialNumToRender={initNum}
      windowSize={windowSize}
      /* eslint-disable-next-line react-native/no-inline-styles */
      style={{
        backgroundColor: colorScheme === 'light' ? '#ffffff' : '#000000',
      }}
      {...flatListProps}
      data={rnElements}
      renderItem={renderItem}
    />
  );
};

export default memo(Markdown);
