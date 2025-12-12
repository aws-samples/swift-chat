import React, {
  useMemo,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  ViewStyle,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { ColorScheme, useTheme } from '../../../theme';
import HtmlFullScreenViewer from './HtmlFullScreenViewer';

interface HtmlPreviewRendererProps {
  code: string;
  style?: ViewStyle;
}

interface HtmlPreviewRendererRef {
  updateContent: (newCode: string) => void;
}

const HtmlPreviewRenderer = forwardRef<
  HtmlPreviewRendererRef,
  HtmlPreviewRendererProps
>(({ code, style }, ref) => {
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const updateContent = useCallback((_newCode: string) => {
    // Content updates are handled by htmlContent useMemo via code prop
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      updateContent,
    }),
    [updateContent]
  );

  // Inject error handling script into the HTML
  const injectScript = (htmlCode: string) => {
    const errorHandlingScript = `
    <script>
      window.onerror = function(message, source, lineno, colno, error) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'rendered',
            success: false,
            error: message
          }));
        }
        return false;
      };
      window.addEventListener('load', function() {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'rendered',
            success: true
          }));
        }
      });
    </script>
    `;

    if (htmlCode.includes('</body>')) {
      return htmlCode.replace('</body>', `${errorHandlingScript}</body>`);
    } else if (htmlCode.includes('</html>')) {
      return htmlCode.replace('</html>', `${errorHandlingScript}</html>`);
    } else {
      return htmlCode + errorHandlingScript;
    }
  };

  const htmlContent = useMemo(() => injectScript(code), [code]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      // Handle console logs from WebView
      if (message.type === 'console_log') {
        console.log('[HtmlPreview]', message.message);
        return;
      }

      if (message.type === 'console_error') {
        console.error('[HtmlPreview]', message.message);
        setHasError(true);
        return;
      }

      if (message.type === 'rendered' || message.type === 'update_rendered') {
        setHasError(!message.success);
      }
    } catch (error) {
      console.log('[HtmlPreview] Raw message:', event.nativeEvent.data);
    }
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowFullScreen(true)}
        activeOpacity={0.8}
        style={styles.container}>
        <WebView
          source={{ html: htmlContent }}
          style={[styles.webView, style]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          allowFileAccessFromFileURLs={true}
          mixedContentMode="compatibility"
          originWhitelist={['*']}
          scalesPageToFit={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onMessage={handleMessage}
          onError={handleError}
          scrollEnabled={false}
          pointerEvents="none"
        />

        {hasError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{'Invalid HTML'}</Text>
          </View>
        )}
      </TouchableOpacity>

      <HtmlFullScreenViewer
        visible={showFullScreen}
        onClose={() => setShowFullScreen(false)}
        code={code}
      />
    </>
  );
});

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      position: 'relative' as const,
    },
    webView: {
      height: 580,
      backgroundColor: 'transparent' as const,
    },
    errorContainer: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.input,
    },
    errorText: {
      marginTop: 10,
      fontSize: 14,
      color: colors.text,
    },
  });

export default HtmlPreviewRenderer;
