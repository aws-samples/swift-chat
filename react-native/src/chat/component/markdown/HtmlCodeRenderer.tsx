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
import { vs2015, github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Platform } from 'react-native';
import { useAppContext } from '../../../history/AppProvider';
import {
  applyDiff,
  getLatestHtmlCode,
  setLatestHtmlCode,
} from '../../util/DiffUtils';
import { showInfo } from '../../util/ToastUtils';
import CopyButton from './CopyButton';

const CustomCodeHighlighter = React.lazy(
  () => import('./CustomCodeHighlighter')
);

interface HtmlCodeRendererProps {
  text: string;
  language?: string;
  colors: ColorScheme;
  isDark: boolean;
  onPreviewToggle?: (
    expanded: boolean,
    height: number,
    animated: boolean
  ) => void;
  isCompleted?: boolean;
  messageHtmlCode?: string;
  messageDiffCode?: string;
}

interface HtmlCodeRendererRef {
  updateContent: (newText: string) => void;
}

interface HtmlPreviewRendererRef {
  updateContent: (newCode: string) => void;
}

// Check if diff has at least one complete hunk
const hasDiffHunk = (text: string): boolean => {
  return /@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(text);
};

const HtmlCodeRenderer = forwardRef<HtmlCodeRendererRef, HtmlCodeRendererProps>(
  (
    {
      text,
      language,
      colors,
      isDark,
      onPreviewToggle,
      isCompleted,
      messageHtmlCode,
      messageDiffCode,
    },
    ref
  ) => {
    const { sendEvent } = useAppContext();
    const isDiffModeRef = useRef(language === 'diff');
    const hasProcessedRef = useRef(
      Boolean(messageHtmlCode) || isCompleted === true
    );
    const hadMessageHtmlCodeRef = useRef(Boolean(messageHtmlCode));

    const [showPreview, setShowPreview] = useState(
      () =>
        Boolean(messageHtmlCode) ||
        (!isDiffModeRef.current && isCompleted === true)
    );
    const [currentText, setCurrentText] = useState(text);
    const [appliedHtmlCode, setAppliedHtmlCode] = useState<string | undefined>(
      undefined
    );
    const htmlRendererRef = useRef<HtmlPreviewRendererRef>(null);
    const codeContainerRef = useRef<View>(null);
    const previewContainerRef = useRef<View>(null);
    const codeHeightRef = useRef<number>(0);
    const previewHeightRef = useRef<number>(0);
    const styles = createStyles(colors);
    const hljsStyle = isDark ? vs2015 : github;
    const previewHtmlCode = appliedHtmlCode || messageHtmlCode || currentText;

    const updateContent = useCallback(
      (newText: string) => {
        setCurrentText(newText);
        if (showPreview && htmlRendererRef.current) {
          htmlRendererRef.current.updateContent(messageHtmlCode || newText);
        }
      },
      [showPreview, messageHtmlCode]
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

    useEffect(() => {
      if (hasProcessedRef.current || !isCompleted) {
        return;
      }

      if (isDiffModeRef.current) {
        if (hasDiffHunk(text)) {
          const currentHtmlCode = getLatestHtmlCode();
          if (currentHtmlCode) {
            const { success, result } = applyDiff(currentHtmlCode, text);
            if (success) {
              setLatestHtmlCode(result);
              setAppliedHtmlCode(result);
              setShowPreview(true);
              sendEvent('diffApplied', { htmlCode: result, diffCode: text });
            } else {
              showInfo('Diff apply failed, please regenerate');
            }
          }
        }
      } else {
        setLatestHtmlCode(text);
        sendEvent('htmlCodeGenerated', { htmlCode: text });
        setShowPreview(true);
      }
      hasProcessedRef.current = true;
    }, [isCompleted, text, sendEvent]);

    const prevMessageHtmlCodeRef = useRef(messageHtmlCode);
    useEffect(() => {
      if (
        messageHtmlCode &&
        messageHtmlCode !== prevMessageHtmlCodeRef.current
      ) {
        hadMessageHtmlCodeRef.current = true;
        setShowPreview(true);
      }
      prevMessageHtmlCodeRef.current = messageHtmlCode;
    }, [messageHtmlCode]);

    const setCodeMode = useCallback(() => {
      if (!showPreview) {
        return;
      }
      if (previewHeightRef.current === 0) {
        previewContainerRef.current?.measure((_x, _y, _width, height) => {
          previewHeightRef.current = height;
          setShowPreview(false);
          setTimeout(() => {
            codeContainerRef.current?.measure(
              (_x2, _y2, _width2, codeHeight) => {
                codeHeightRef.current = codeHeight;
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
      if (codeHeightRef.current === 0) {
        codeContainerRef.current?.measure((_x, _y, _width, height) => {
          codeHeightRef.current = height;
          setShowPreview(true);
          setTimeout(() => {
            previewContainerRef.current?.measure(
              (_x2, _y2, _width2, previewHeight) => {
                previewHeightRef.current = previewHeight;
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
                  {isDiffModeRef.current ? 'diff' : 'code'}
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
          <CopyButton
            content={() =>
              showPreview || !isDiffModeRef.current
                ? previewHtmlCode
                : currentText
            }
          />
        </View>

        <View
          ref={codeContainerRef}
          style={showPreview && isCompleted ? styles.hidden : undefined}>
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
              language={isDiffModeRef.current ? 'diff' : 'html'}
              isCompleted={isCompleted}>
              {isDiffModeRef.current
                ? messageDiffCode || currentText
                : messageHtmlCode || currentText}
            </CustomCodeHighlighter>
          </Suspense>
        </View>

        {isCompleted && (
          <View
            ref={previewContainerRef}
            style={!showPreview ? styles.hidden : undefined}>
            <HtmlPreviewRenderer
              ref={htmlRendererRef}
              code={previewHtmlCode}
              style={styles.htmlRenderer}
            />
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
    hidden: {
      position: 'absolute',
      opacity: 0,
      pointerEvents: 'none',
    },
  });

export default HtmlCodeRenderer;
