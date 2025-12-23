import React, {
  memo,
  useRef,
  useState,
  useEffect,
  type FunctionComponent,
} from 'react';
import {
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

const CHUNK_SIZE = 100;

interface ChunkedCodeViewProps {
  code: string;
  textStyle?: StyleProp<TextStyle>;
  backgroundColor?: string;
  scrollViewProps?: ScrollViewProps;
  containerStyle?: StyleProp<ViewStyle>;
  isCompleted?: boolean;
}

interface ChunkTextProps {
  content: string;
  textStyle?: StyleProp<TextStyle>;
  isComplete: boolean;
}

// Memoized chunk - complete chunks never re-render
const ChunkText: FunctionComponent<ChunkTextProps> = memo(
  ({ content, textStyle }) => {
    if (Platform.OS === 'ios') {
      return (
        <TextInput
          style={[styles.chunkText, textStyle]}
          editable={false}
          multiline
          scrollEnabled={false}>
          {content}
        </TextInput>
      );
    }
    return <Text style={textStyle}>{content}</Text>;
  },
  (prevProps, nextProps) => {
    if (prevProps.isComplete) {
      return true;
    }
    return prevProps.content === nextProps.content;
  }
);

// Incremental line tracking - O(delta) instead of O(n)
const useChunkedCode = (code: string, isCompleted?: boolean): string[] => {
  const linesRef = useRef<string[]>([]);
  const processedLengthRef = useRef<number>(0);
  const incompleteLineRef = useRef<string>('');
  const completedChunksRef = useRef<string[]>([]);
  const updateCountRef = useRef(0);

  const [completeChunks, setCompleteChunks] = useState<string[]>([]);
  const [lastChunk, setLastChunk] = useState<string>('');

  useEffect(() => {
    const prevLength = processedLengthRef.current;
    const isReset =
      code.length < prevLength || !code.startsWith(code.slice(0, prevLength));

    if (isReset) {
      linesRef.current = [];
      processedLengthRef.current = 0;
      incompleteLineRef.current = '';
      completedChunksRef.current = [];
      updateCountRef.current = 0;
      setCompleteChunks([]);
      setLastChunk('');
    }

    const newContent = code.slice(processedLengthRef.current);
    if (!newContent) {
      return;
    }

    // Always update refs to keep line tracking accurate
    const newParts = newContent.split('\n');

    if (newParts.length > 0) {
      if (incompleteLineRef.current) {
        const lastLineIndex = linesRef.current.length - 1;
        if (lastLineIndex >= 0) {
          linesRef.current[lastLineIndex] += newParts[0];
        } else {
          linesRef.current.push(newParts[0]);
        }
      } else {
        linesRef.current.push(newParts[0]);
      }

      for (let i = 1; i < newParts.length; i++) {
        linesRef.current.push(newParts[i]);
      }

      incompleteLineRef.current = code.endsWith('\n')
        ? ''
        : newParts[newParts.length - 1];
    }

    processedLengthRef.current = code.length;

    const totalLines = linesRef.current.length;
    const completeChunkCount = Math.floor(totalLines / CHUNK_SIZE);

    // Always update completed chunks ref to avoid data loss
    let chunksChanged = false;
    for (
      let i = completedChunksRef.current.length;
      i < completeChunkCount;
      i++
    ) {
      const start = i * CHUNK_SIZE;
      const end = start + CHUNK_SIZE;
      const chunk = linesRef.current.slice(start, end).join('\n');
      completedChunksRef.current.push(chunk);
      chunksChanged = true;
    }

    const remainingStart = completeChunkCount * CHUNK_SIZE;
    const remainingLines = totalLines - remainingStart;
    const rawLastChunk =
      remainingLines > 0
        ? linesRef.current.slice(remainingStart).join('\n')
        : '';

    // Throttle: skip odd state updates during streaming (but refs are already updated)
    updateCountRef.current++;
    if (!isReset && !isCompleted && updateCountRef.current % 2 !== 0) {
      return;
    }

    if (chunksChanged) {
      setCompleteChunks([...completedChunksRef.current]);
    }
    setLastChunk(rawLastChunk);
  }, [code, isCompleted]);

  if (lastChunk) {
    return [...completeChunks, lastChunk];
  }
  return completeChunks.length > 0 ? completeChunks : code ? [code] : [];
};

/**
 * Chunked code renderer - splits into CHUNK_SIZE line chunks.
 * Complete chunks are memoized, only last chunk updates during streaming.
 */
const ChunkedCodeView: FunctionComponent<ChunkedCodeViewProps> = ({
  code,
  textStyle,
  backgroundColor,
  scrollViewProps,
  containerStyle,
  isCompleted,
}) => {
  const chunks = useChunkedCode(code, isCompleted);

  return (
    <ScrollView
      {...scrollViewProps}
      horizontal
      nestedScrollEnabled={false}
      contentContainerStyle={[
        { backgroundColor },
        scrollViewProps?.contentContainerStyle,
        containerStyle,
      ]}>
      <View style={styles.chunksContainer}>
        {chunks.map((chunk, index) => (
          <ChunkText
            key={index}
            content={chunk}
            textStyle={textStyle}
            isComplete={index < chunks.length - 1}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  chunksContainer: {
    flexDirection: 'column',
  },
  chunkText: {},
});

export default ChunkedCodeView;
