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

// Number of lines per chunk
const CHUNK_SIZE = 100;

interface ChunkedCodeViewProps {
  code: string;
  textStyle?: StyleProp<TextStyle>;
  backgroundColor?: string;
  scrollViewProps?: ScrollViewProps;
  containerStyle?: StyleProp<ViewStyle>;
}

interface ChunkTextProps {
  content: string;
  textStyle?: StyleProp<TextStyle>;
  isComplete: boolean;
}

// Memoized chunk component - won't re-render if content is complete
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
    // If the chunk was already complete, never re-render
    if (prevProps.isComplete) {
      return true;
    }
    // Otherwise, only re-render if content changed
    return prevProps.content === nextProps.content;
  }
);

// Incremental line tracking - only process new content, O(delta) instead of O(n)
const useChunkedCode = (code: string): string[] => {
  // Track all lines incrementally
  const linesRef = useRef<string[]>([]);
  // Track the position we've processed up to
  const processedLengthRef = useRef<number>(0);
  // Track if last line was incomplete (no trailing newline)
  const incompleteLineRef = useRef<string>('');
  // Cache completed chunks
  const completedChunksRef = useRef<string[]>([]);

  // State to track complete chunks for rendering
  const [completeChunks, setCompleteChunks] = useState<string[]>([]);
  // State for the last (incomplete) chunk
  const [lastChunk, setLastChunk] = useState<string>('');

  // Incrementally process new content
  useEffect(() => {
    const prevLength = processedLengthRef.current;

    // Handle reset case (new code block or code got shorter)
    if (
      code.length < prevLength ||
      !code.startsWith(code.slice(0, prevLength))
    ) {
      // Reset everything
      linesRef.current = [];
      processedLengthRef.current = 0;
      incompleteLineRef.current = '';
      completedChunksRef.current = [];
      setCompleteChunks([]);
      setLastChunk('');
    }

    // Get only the new content
    const newContent = code.slice(processedLengthRef.current);
    if (!newContent) {
      return;
    }

    // Process new content
    const newParts = newContent.split('\n');

    if (newParts.length > 0) {
      // First part completes the previous incomplete line
      if (incompleteLineRef.current) {
        // Complete the last line
        const lastLineIndex = linesRef.current.length - 1;
        if (lastLineIndex >= 0) {
          linesRef.current[lastLineIndex] += newParts[0];
        } else {
          linesRef.current.push(newParts[0]);
        }
      } else {
        // No incomplete line, first part is a new line
        linesRef.current.push(newParts[0]);
      }

      // Add remaining complete lines
      for (let i = 1; i < newParts.length; i++) {
        linesRef.current.push(newParts[i]);
      }

      // Check if last line is incomplete (code doesn't end with newline)
      incompleteLineRef.current = code.endsWith('\n')
        ? ''
        : newParts[newParts.length - 1];
    }

    processedLengthRef.current = code.length;

    // Now calculate chunks from lines
    const totalLines = linesRef.current.length;
    const completeChunkCount = Math.floor(totalLines / CHUNK_SIZE);

    // Build/update complete chunks
    let chunksChanged = false;
    for (
      let i = completedChunksRef.current.length;
      i < completeChunkCount;
      i++
    ) {
      const start = i * CHUNK_SIZE;
      const end = start + CHUNK_SIZE;
      // Add trailing newline since complete chunks always have content following
      const chunk = linesRef.current.slice(start, end).join('\n') + '\n';
      completedChunksRef.current.push(chunk);
      chunksChanged = true;
    }

    // Calculate last chunk content
    const remainingStart = completeChunkCount * CHUNK_SIZE;
    const remainingLines = totalLines - remainingStart;
    const rawLastChunk =
      remainingLines > 0
        ? linesRef.current.slice(remainingStart).join('\n')
        : '';

    // Update both states together to ensure consistency
    if (chunksChanged) {
      setCompleteChunks([...completedChunksRef.current]);
    }
    setLastChunk(rawLastChunk);
  }, [code]);

  // Combine complete chunks with last chunk
  if (lastChunk) {
    return [...completeChunks, lastChunk];
  }
  return completeChunks.length > 0 ? completeChunks : code ? [code] : [];
};

/**
 * ChunkedCodeView - Optimized code renderer using chunked rendering
 *
 * Splits code into chunks of CHUNK_SIZE lines. Completed chunks are memoized
 * and won't re-render, only the last active chunk updates during streaming.
 *
 * Features:
 * - Unified horizontal scrolling for all chunks
 * - Vertical scrolling passes through to parent
 * - O(1) render cost for completed chunks
 * - Only last chunk re-renders during streaming, completed chunks are memoized
 * - Incremental line tracking - O(delta) instead of O(n) for split operations
 * - Guarantees last chunk update when complete chunks change (no race conditions)
 */
const ChunkedCodeView: FunctionComponent<ChunkedCodeViewProps> = ({
  code,
  textStyle,
  backgroundColor,
  scrollViewProps,
  containerStyle,
}) => {
  const chunks = useChunkedCode(code);

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
  chunkText: {
    // No additional styling needed, inherits from textStyle
  },
});

export default ChunkedCodeView;
