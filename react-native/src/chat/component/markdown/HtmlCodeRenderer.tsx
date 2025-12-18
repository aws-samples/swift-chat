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
  onPreviewToggle?: (
    expanded: boolean,
    height: number,
    animated: boolean
  ) => void;
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
  ({ text, colors, isDark, onCopy, onPreviewToggle }, ref) => {
    // Default to preview mode when HTML is complete
    const [showPreview, setShowPreview] = useState(() => isHtmlComplete(text));
    const [currentText, setCurrentText] = useState(text);
    const [hasAutoSwitched, setHasAutoSwitched] = useState(() =>
      isHtmlComplete(text)
    );
    const htmlRendererRef = useRef<HtmlPreviewRendererRef>(null);
    const codeContainerRef = useRef<View>(null);
    const previewContainerRef = useRef<View>(null);
    const codeHeightRef = useRef<number>(0);
    const previewHeightRef = useRef<number>(0);
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

    const setCodeMode = useCallback(() => {
      if (!showPreview) {
        return;
      }
      // Switching from preview to code
      if (previewHeightRef.current === 0) {
        // Need to measure current preview height first
        previewContainerRef.current?.measure((_x, _y, _width, height) => {
          previewHeightRef.current = height;
          setShowPreview(false);
          setTimeout(() => {
            codeContainerRef.current?.measure(
              (_x2, _y2, _width2, codeHeight) => {
                codeHeightRef.current = codeHeight;
                // heightDiff > 0 means code is taller (expanding), < 0 means code is shorter (collapsing)
                const heightDiff = codeHeight - previewHeightRef.current;
                if (heightDiff !== 0) {
                  onPreviewToggle?.(heightDiff > 0, Math.abs(heightDiff), true);
                }
              }
            );
          }, 150);
        });
      } else {
        setShowPreview(false);
        if (codeHeightRef.current === 0) {
          setTimeout(() => {
            codeContainerRef.current?.measure((_x, _y, _width, codeHeight) => {
              codeHeightRef.current = codeHeight;
              const heightDiff = codeHeight - previewHeightRef.current;
              if (heightDiff !== 0) {
                onPreviewToggle?.(heightDiff > 0, Math.abs(heightDiff), true);
              }
            });
          }, 150);
        } else {
          const heightDiff = codeHeightRef.current - previewHeightRef.current;
          if (heightDiff !== 0) {
            setTimeout(() => {
              onPreviewToggle?.(heightDiff > 0, Math.abs(heightDiff), false);
            }, 0);
          }
        }
      }
    }, [showPreview, onPreviewToggle]);

    const setPreviewMode = useCallback(() => {
      if (showPreview) {
        return;
      }
      // Switching from code to preview
      if (codeHeightRef.current === 0) {
        // Need to measure current code height first
        codeContainerRef.current?.measure((_x, _y, _width, height) => {
          codeHeightRef.current = height;
          setShowPreview(true);
          setTimeout(() => {
            previewContainerRef.current?.measure(
              (_x2, _y2, _width2, previewHeight) => {
                previewHeightRef.current = previewHeight;
                // heightDiff > 0 means preview is taller (expanding), < 0 means preview is shorter (collapsing)
                const heightDiff = previewHeight - codeHeightRef.current;
                if (heightDiff !== 0) {
                  onPreviewToggle?.(heightDiff > 0, Math.abs(heightDiff), true);
                }
              }
            );
          }, 150);
        });
      } else {
        setShowPreview(true);
        if (previewHeightRef.current === 0) {
          setTimeout(() => {
            previewContainerRef.current?.measure(
              (_x, _y, _width, previewHeight) => {
                previewHeightRef.current = previewHeight;
                const heightDiff = previewHeight - codeHeightRef.current;
                if (heightDiff !== 0) {
                  onPreviewToggle?.(heightDiff > 0, Math.abs(heightDiff), true);
                }
              }
            );
          }, 150);
        } else {
          const heightDiff = previewHeightRef.current - codeHeightRef.current;
          if (heightDiff !== 0) {
            setTimeout(() => {
              onPreviewToggle?.(heightDiff > 0, Math.abs(heightDiff), false);
            }, 0);
          }
        }
      }
    }, [showPreview, onPreviewToggle]);

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
          <View ref={previewContainerRef}>
            <HtmlPreviewRenderer
              ref={htmlRendererRef}
              code={currentText}
              style={styles.htmlRenderer}
            />
          </View>
        ) : (
          <View ref={codeContainerRef}>
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
                language="html">
                {currentText}
              </CustomCodeHighlighter>
            </Suspense>
          </View>
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
