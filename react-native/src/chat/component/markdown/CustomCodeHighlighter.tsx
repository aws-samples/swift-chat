import React, {
  type CSSProperties,
  type FunctionComponent,
  type ReactNode,
  useMemo,
  useCallback,
  memo,
  useRef,
  useState,
  useEffect,
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
import SyntaxHighlighter, {
  type SyntaxHighlighterProps,
} from 'react-syntax-highlighter';
import transform, { StyleTuple } from 'css-to-react-native';
import { isMac } from '../../../App.tsx';
import { trimNewlines } from 'trim-newlines';

// Streaming optimization constants
// Time (ms) to wait after last content change before applying syntax highlighting
const STREAMING_IDLE_THRESHOLD_MS = 400;
// Minimum lines to enable streaming optimization (skip highlighting during streaming)
const STREAMING_LINE_THRESHOLD = 25;

type ReactStyle = Record<string, CSSProperties>;
type HighlighterStyleSheet = { [key: string]: TextStyle };

export interface CodeHighlighterProps extends SyntaxHighlighterProps {
  hljsStyle: ReactStyle;
  textStyle?: StyleProp<TextStyle>;
  scrollViewProps?: ScrollViewProps;
  /**
   * @deprecated Use scrollViewProps.contentContainerStyle instead
   */
  containerStyle?: StyleProp<ViewStyle>;
}

const getRNStylesFromHljsStyle = (
  hljsStyle: ReactStyle
): HighlighterStyleSheet => {
  return Object.fromEntries(
    Object.entries(hljsStyle).map(([className, style]) => [
      className,
      cleanStyle(style),
    ])
  );
};

const cleanStyle = (style: CSSProperties) => {
  const styles = Object.entries(style)
    .filter(([key]) => ALLOWED_STYLE_PROPERTIES[key])
    .map<StyleTuple>(([key, value]) => [key, value]);

  return transform(styles);
};
const ALLOWED_STYLE_PROPERTIES: Record<string, boolean> = {
  color: true,
  background: true,
  backgroundColor: true,
  fontWeight: true,
  fontStyle: true,
};

// Memoized Text component to prevent unnecessary re-renders
const MemoizedText = memo(
  ({
    style,
    children,
  }: {
    style: StyleProp<TextStyle>;
    children: ReactNode;
  }) => <Text style={style}>{children}</Text>
);

// Threshold for throttling updates in plain text view
const PLAIN_TEXT_THROTTLE_LINE_THRESHOLD = 50;

// Plain text renderer for streaming mode - much faster than syntax highlighting
const PlainTextCodeView: FunctionComponent<{
  code: string;
  textStyle?: StyleProp<TextStyle>;
  backgroundColor?: string;
  scrollViewProps?: ScrollViewProps;
  containerStyle?: StyleProp<ViewStyle>;
  language?: string;
}> = memo(
  ({
    code,
    textStyle,
    backgroundColor,
    scrollViewProps,
    containerStyle,
    language,
  }) => {
    const lines = code.split('\n');
    const lineCount = lines.length;
    const prevLineCountRef = useRef(lineCount);

    // For large code blocks (>100 lines), only update when line count changes
    const [displayedCode, setDisplayedCode] = useState(code);

    useEffect(() => {
      if (lineCount < PLAIN_TEXT_THROTTLE_LINE_THRESHOLD) {
        // Small code blocks: update every change
        setDisplayedCode(code);
      } else if (lineCount !== prevLineCountRef.current) {
        // Large code blocks: only update when line count changes
        setDisplayedCode(code);
      }
      prevLineCountRef.current = lineCount;
    }, [code, lineCount]);

    const displayedLines = displayedCode.split('\n');
    const scale = language === 'mermaid' ? 1.75 : isMac ? 2 : 2.75;
    const marginBottomValue = -displayedLines.length * scale;

    return (
      <ScrollView
        {...scrollViewProps}
        horizontal
        contentContainerStyle={[
          { backgroundColor },
          scrollViewProps?.contentContainerStyle,
          containerStyle,
        ]}>
        <View onStartShouldSetResponder={() => true}>
          {Platform.OS === 'ios' ? (
            <TextInput
              style={[
                styles.inputText,
                textStyle,
                { marginBottom: marginBottomValue },
              ]}
              editable={false}
              multiline>
              {displayedCode}
            </TextInput>
          ) : (
            <Text style={textStyle}>{displayedCode}</Text>
          )}
        </View>
      </ScrollView>
    );
  }
);

export const CustomCodeHighlighter: FunctionComponent<CodeHighlighterProps> = ({
  children,
  textStyle,
  hljsStyle,
  scrollViewProps,
  containerStyle,
  ...rest
}) => {
  const stylesheet: HighlighterStyleSheet = useMemo(
    () => getRNStylesFromHljsStyle(hljsStyle),
    [hljsStyle]
  );

  // Streaming detection state
  const childrenString = String(children);
  const lineCount = childrenString.split('\n').length;
  const isLargeCodeBlock = lineCount >= STREAMING_LINE_THRESHOLD;

  // Small code blocks always show highlighted, large ones start with plain text
  const [showHighlighted, setShowHighlighted] = useState(!isLargeCodeBlock);
  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLengthRef = useRef(childrenString.length);

  useEffect(() => {
    const wasGrowing = childrenString.length > prevLengthRef.current;
    prevLengthRef.current = childrenString.length;

    // Clear existing timer
    if (streamingTimerRef.current) {
      clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }

    // For large code blocks: disable highlighting during streaming, re-enable after idle
    if (isLargeCodeBlock) {
      if (wasGrowing) {
        setShowHighlighted(false);
      }
      // Always set timer to enable highlighting after content stabilizes
      if (!showHighlighted) {
        streamingTimerRef.current = setTimeout(() => {
          setShowHighlighted(true);
          streamingTimerRef.current = null;
        }, STREAMING_IDLE_THRESHOLD_MS);
      }
    }
  }, [childrenString.length, isLargeCodeBlock, showHighlighted]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (streamingTimerRef.current) {
        clearTimeout(streamingTimerRef.current);
      }
    };
  }, []);

  const getStylesForNode = useCallback(
    (node: rendererNode): TextStyle[] => {
      const classes: string[] = node.properties?.className ?? [];
      return classes
        .map((c: string) => stylesheet[c])
        .filter(c => !!c) as TextStyle[];
    },
    [stylesheet]
  );

  // Calculate base text style once
  const baseTextStyle = useMemo(
    () => [textStyle, { color: stylesheet.hljs?.color }],
    [textStyle, stylesheet.hljs?.color]
  );

  // Cache of previously processed nodes (must be before conditional return for hooks rules)
  const processedNodesCache = useRef<ReactNode[][]>([]);
  const prevNodesLength = useRef<number>(0);

  // Process a single node into React elements
  const processNode = useCallback(
    (node: rendererNode, index: number): ReactNode[] => {
      const stack: rendererNode[] = [node];
      let result: ReactNode[] = [];

      while (stack.length > 0) {
        const currentNode = stack.pop()!;

        if (currentNode.type === 'text') {
          result.push(currentNode.value || '');
        } else if (currentNode.children) {
          const childElements = currentNode.children.map(
            (child, childIndex) => {
              if (child.type === 'text') {
                const nodeStyles = getStylesForNode(currentNode);
                return (
                  <MemoizedText
                    key={`${index}-${childIndex}`}
                    style={[...baseTextStyle, ...nodeStyles]}>
                    {child.value}
                  </MemoizedText>
                );
              } else {
                const childStyles = getStylesForNode(child);
                const childContent = child.children
                  ?.map(grandChild => grandChild.value)
                  .join('');

                return (
                  <MemoizedText
                    key={`${index}-${childIndex}`}
                    style={[...baseTextStyle, ...childStyles]}>
                    {childContent}
                  </MemoizedText>
                );
              }
            }
          );
          result = result.concat(childElements);
        }
      }
      return result;
    },
    [baseTextStyle, getStylesForNode]
  );

  const renderNode = useCallback(
    (nodes: rendererNode[]): ReactNode => {
      // Calculate margin bottom value once
      const scale = rest.language === 'mermaid' ? 1.75 : isMac ? 2 : 2.75;
      const marginBottomValue = -nodes.length * scale;

      // Optimization for streaming content - only process new nodes
      if (nodes.length >= prevNodesLength.current) {
        // When initial render or nodes are added (streaming case)
        if (processedNodesCache.current.length === 0) {
          // First render - process all nodes
          processedNodesCache.current = nodes.map((node, index) =>
            processNode(node, index)
          );
        } else if (nodes.length > prevNodesLength.current) {
          // Streaming case - only process new nodes
          for (let i = prevNodesLength.current; i < nodes.length; i++) {
            processedNodesCache.current[i] = processNode(nodes[i], i);
          }
        }
        // If same length but content changed (rare in streaming), we'll keep the cache as is
      } else {
        // If nodes length decreased (rare case, not typical for streaming)
        processedNodesCache.current = nodes.map((node, index) =>
          processNode(node, index)
        );
      }

      // Update length reference for next render
      prevNodesLength.current = nodes.length;

      return (
        <TextInput
          style={[
            styles.inputText,
            {
              marginBottom: marginBottomValue,
            },
          ]}
          editable={false}
          multiline>
          {processedNodesCache.current}
        </TextInput>
      );
    },
    [processNode, rest.language]
  );

  const renderAndroidNode = useCallback(
    (nodes: rendererNode[], keyPrefix = 'row') =>
      nodes.reduce<ReactNode[]>((acc, node, index) => {
        const keyPrefixWithIndex = `${keyPrefix}_${index}`;
        if (node.children) {
          const nodeStyles = StyleSheet.flatten([
            textStyle,
            { color: stylesheet.hljs?.color },
            getStylesForNode(node),
          ]);
          acc.push(
            <Text style={nodeStyles} key={keyPrefixWithIndex}>
              {renderAndroidNode(node.children, `${keyPrefixWithIndex}_child`)}
            </Text>
          );
        }

        if (node.value) {
          acc.push(trimNewlines(String(node.value)));
        }

        return acc;
      }, []),
    [textStyle, stylesheet, getStylesForNode]
  );

  const renderer = useCallback(
    (props: rendererProps) => {
      const { rows } = props;
      return (
        <ScrollView
          {...scrollViewProps}
          horizontal
          contentContainerStyle={[
            stylesheet.hljs,
            scrollViewProps?.contentContainerStyle,
            containerStyle,
          ]}>
          <View onStartShouldSetResponder={() => true}>
            {Platform.OS === 'ios' ? renderNode(rows) : renderAndroidNode(rows)}
          </View>
        </ScrollView>
      );
    },
    [stylesheet, scrollViewProps, containerStyle, renderNode, renderAndroidNode]
  );

  // During streaming, render plain text for performance
  if (!showHighlighted) {
    return (
      <PlainTextCodeView
        code={childrenString}
        textStyle={[textStyle, { color: stylesheet.hljs?.color }]}
        backgroundColor={stylesheet.hljs?.backgroundColor as string}
        scrollViewProps={scrollViewProps}
        containerStyle={containerStyle}
        language={rest.language}
      />
    );
  }

  return (
    <SyntaxHighlighter
      {...rest}
      renderer={renderer}
      CodeTag={View}
      PreTag={View}
      style={{}}
      testID="react-native-code-highlighter">
      {children}
    </SyntaxHighlighter>
  );
};

const styles = StyleSheet.create({
  inputText: {
    lineHeight: 20,
    marginTop: -5,
  },
});

export default CustomCodeHighlighter;
