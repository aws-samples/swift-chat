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
  /**
   * If true, always show syntax highlighting (skip streaming plain text mode)
   */
  forceHighlight?: boolean;
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

interface PlainTextCodeViewProps {
  code: string;
  textStyle?: StyleProp<TextStyle>;
  backgroundColor?: string;
  scrollViewProps?: ScrollViewProps;
  containerStyle?: StyleProp<ViewStyle>;
}

// Plain text renderer for streaming mode
// For large code blocks (>=10 lines), only re-renders when line count changes to prevent jitter
const PlainTextCodeView: FunctionComponent<PlainTextCodeViewProps> = memo(
  ({ code, textStyle, backgroundColor, scrollViewProps, containerStyle }) => {
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
              style={[styles.plainTextInput, textStyle]}
              editable={false}
              multiline>
              {code}
            </TextInput>
          ) : (
            <Text style={textStyle}>{code}</Text>
          )}
        </View>
      </ScrollView>
    );
  },
  (prevProps, nextProps) => {
    // Skip re-render if backgroundColor changes
    if (prevProps.backgroundColor !== nextProps.backgroundColor) {
      return false;
    }

    const prevLineCount = prevProps.code.split('\n').length;
    const nextLineCount = nextProps.code.split('\n').length;

    // Small blocks: re-render on any code change
    if (nextLineCount < PLAIN_TEXT_THROTTLE_LINE_THRESHOLD) {
      return prevProps.code === nextProps.code;
    }

    // Large blocks: only re-render when line count changes
    return prevLineCount === nextLineCount;
  }
);

export const CustomCodeHighlighter: FunctionComponent<CodeHighlighterProps> = ({
  children,
  textStyle,
  hljsStyle,
  scrollViewProps,
  containerStyle,
  forceHighlight,
  ...rest
}) => {
  const stylesheet: HighlighterStyleSheet = useMemo(
    () => getRNStylesFromHljsStyle(hljsStyle),
    [hljsStyle]
  );

  // Streaming detection state
  const childrenString = String(children);
  // Small code blocks always show highlighted, large ones start with plain text
  const [showHighlighted, setShowHighlighted] = useState(false);
  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLengthRef = useRef(childrenString.length);

  useEffect(() => {
    // Skip auto-highlighting logic if forceHighlight is provided (controlled externally)
    if (forceHighlight !== undefined) {
      return;
    }

    const wasGrowing = childrenString.length > prevLengthRef.current;
    prevLengthRef.current = childrenString.length;

    // Clear existing timer
    if (streamingTimerRef.current) {
      clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }

    // For large code blocks: disable highlighting during streaming, re-enable after idle
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
  }, [childrenString.length, showHighlighted, forceHighlight]);

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

  // Calculate base text style once - used for both PlainTextCodeView and highlighted view
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
      const scale =
        rest.language === 'mermaid'
          ? 1.75
          : rest.language === 'html'
          ? isMac
            ? 2
            : 1.85
          : isMac
          ? 3
          : 2.75;
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

  // Determine if we should show highlighting
  // Use forceHighlight if provided, otherwise use internal showHighlighted state
  const shouldHighlight = forceHighlight !== undefined ? forceHighlight : showHighlighted;

  // During streaming, render plain text for performance
  if (!shouldHighlight) {
    return (
      <PlainTextCodeView
        code={childrenString}
        textStyle={baseTextStyle}
        backgroundColor={stylesheet.hljs?.backgroundColor as string}
        scrollViewProps={scrollViewProps}
        containerStyle={containerStyle}
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
  // Plain text input - no lineHeight override, let it use natural height based on fontSize
  plainTextInput: {},
});

export default CustomCodeHighlighter;
