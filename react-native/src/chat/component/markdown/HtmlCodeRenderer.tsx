import React, {
  useState,
  Suspense,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ColorScheme } from '../../../theme';
import HtmlPreviewRenderer from './HtmlPreviewRenderer';
import { CopyButton } from './CustomMarkdownRenderer';
import { vs2015, github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Platform } from 'react-native';

const CustomCodeHighlighter = React.lazy(
  () => import('./CustomCodeHighlighter')
);

interface HtmlCodeRendererProps {
  text: string;
  colors: ColorScheme;
  isDark: boolean;
  onCopy: () => void;
}

interface HtmlCodeRendererRef {
  updateContent: (newText: string) => void;
}

interface HtmlPreviewRendererRef {
  updateContent: (newCode: string) => void;
}

// Check if HTML content is complete (ends with </html>)
const isHtmlComplete = (html: string): boolean => {
  return html.trimEnd().toLowerCase().endsWith('</html>');
};

const HtmlCodeRenderer = forwardRef<HtmlCodeRendererRef, HtmlCodeRendererProps>(
  ({ text, colors, isDark, onCopy }, ref) => {
    const [showPreview, setShowPreview] = useState(false);
    const [currentText, setCurrentText] = useState(text);
    const [hasAutoSwitched, setHasAutoSwitched] = useState(false);
    const htmlRendererRef = useRef<HtmlPreviewRendererRef>(null);
    const styles = createStyles(colors);
    const hljsStyle = isDark ? vs2015 : github;

    const updateContent = useCallback(
      (newText: string) => {
        setCurrentText(newText);
        if (showPreview && htmlRendererRef.current) {
          htmlRendererRef.current.updateContent(newText);
        }
      },
      [showPreview]
    );

    useImperativeHandle(
      ref,
      () => ({
        updateContent,
      }),
      [updateContent]
    );

    useEffect(() => {
      setCurrentText(text);
    }, [text]);

    // Auto-switch to preview when HTML is complete (ends with </html>)
    useEffect(() => {
      if (hasAutoSwitched || showPreview) {
        return;
      }

      if (isHtmlComplete(text)) {
        setShowPreview(true);
        setHasAutoSwitched(true);
      }
    }, [text, hasAutoSwitched, showPreview]);

    const setCodeMode = () => {
      setShowPreview(false);
    };

    const setPreviewMode = () => {
      setShowPreview(true);
    };

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.leftSection}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                onPress={setCodeMode}
                style={[styles.tabButton, !showPreview && styles.activeTab]}>
                <Text
                  style={[
                    styles.tabText,
                    !showPreview && styles.activeTabText,
                  ]}>
                  code
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={setPreviewMode}
                style={[styles.tabButton, showPreview && styles.activeTab]}>
                <Text
                  style={[styles.tabText, showPreview && styles.activeTabText]}>
                  preview
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <CopyButton onCopy={onCopy} colors={colors} isDark={isDark} />
        </View>

        {showPreview ? (
          <HtmlPreviewRenderer
            ref={htmlRendererRef}
            code={currentText}
            style={styles.htmlRenderer}
          />
        ) : (
          <Suspense fallback={<Text style={styles.loading}>Loading...</Text>}>
            <CustomCodeHighlighter
              hljsStyle={hljsStyle}
              scrollViewProps={{
                contentContainerStyle: {
                  padding: 12,
                  minWidth: '100%',
                  borderBottomLeftRadius: 8,
                  borderBottomRightRadius: 8,
                  backgroundColor: colors.codeBackground,
                },
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                backgroundColor: colors.codeBackground,
              }}
              textStyle={styles.codeText}
              language="html"
              forceHighlight={isHtmlComplete(currentText)}>
              {currentText}
            </CustomCodeHighlighter>
          </Suspense>
        )}
      </View>
    );
  }
);

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: colors.input,
      marginVertical: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.borderLight,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: 4,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.input,
      borderRadius: 6,
      padding: 2,
    },
    tabButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
      marginHorizontal: 1,
    },
    activeTab: {
      backgroundColor: colors.text,
    },
    tabText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
      opacity: 0.6,
    },
    activeTabText: {
      color: colors.background,
      opacity: 1,
    },
    loading: {
      padding: 12,
      color: colors.text,
    },
    codeText: {
      fontSize: 14,
      paddingVertical: 1.3,
      fontFamily: Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace',
      color: colors.text,
    },
    htmlRenderer: {
      marginVertical: 0,
      minHeight: 100,
    },
  });

export default HtmlCodeRenderer;
