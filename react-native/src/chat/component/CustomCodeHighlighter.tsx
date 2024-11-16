import React, {
  type CSSProperties,
  type FunctionComponent,
  type ReactNode,
  useMemo,
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
import { isMac } from '../../App.tsx';
import { trimNewlines } from 'trim-newlines';

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

  const getStylesForNode = (node: rendererNode): TextStyle[] => {
    const classes: string[] = node.properties?.className ?? [];
    return classes
      .map((c: string) => stylesheet[c])
      .filter(c => !!c) as TextStyle[];
  };

  const renderNode = (nodes: rendererNode[]): ReactNode => {
    return (
      <TextInput
        style={[
          styles.inputText,
          {
            marginBottom: -nodes.length * (isMac ? 3 : 2.6),
          },
        ]}
        editable={false}
        multiline>
        {nodes.map((node, index) => {
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
                    return (
                      <Text
                        key={`${index}-${childIndex}`}
                        style={[
                          textStyle,
                          { color: stylesheet.hljs?.color },
                          getStylesForNode(currentNode),
                        ]}>
                        {child.value}
                      </Text>
                    );
                  } else {
                    return (
                      <Text
                        key={`${index}-${childIndex}`}
                        style={[
                          textStyle,
                          { color: stylesheet.hljs?.color },
                          getStylesForNode(child),
                        ]}>
                        {child.children
                          ?.map(grandChild => grandChild.value)
                          .join('')}
                      </Text>
                    );
                  }
                }
              );
              result = result.concat(childElements);
            }
          }
          return result;
        })}
      </TextInput>
    );
  };

  const renderAndroidNode = (nodes: rendererNode[], keyPrefix = 'row') =>
    nodes.reduce<ReactNode[]>((acc, node, index) => {
      const keyPrefixWithIndex = `${keyPrefix}_${index}`;
      if (node.children) {
        const styles = StyleSheet.flatten([
          textStyle,
          { color: stylesheet.hljs?.color },
          getStylesForNode(node),
        ]);
        acc.push(
          <Text style={styles} key={keyPrefixWithIndex}>
            {renderAndroidNode(node.children, `${keyPrefixWithIndex}_child`)}
          </Text>
        );
      }

      if (node.value) {
        acc.push(trimNewlines(String(node.value)));
      }

      return acc;
    }, []);

  const renderer = (props: rendererProps) => {
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
  };

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
