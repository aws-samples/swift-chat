import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ViewStyle, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../theme';
import MermaidFullScreenViewer from './MermaidFullScreenViewer';

interface MermaidRendererProps {
  code: string;
  style?: ViewStyle;
}

interface MermaidRendererRef {
  updateContent: (newCode: string) => void;
}

const MermaidRenderer = forwardRef<MermaidRendererRef, MermaidRendererProps>(
  ({ code, style }, ref) => {
    const [currentCode, setCurrentCode] = useState(code);
    const [showFullScreen, setShowFullScreen] = useState(false);
    const webViewRef = useRef<WebView>(null);
    const initialCodeRef = useRef<string>(code);
    const { isDark } = useTheme();

    const updateContent = useCallback(
      (newCode: string) => {
        if (newCode === currentCode) {
          return;
        }
        if (webViewRef.current) {
          const escapedCode = newCode
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');
          const jsCode = `
        (function() {
          try {
            const container = document.getElementById('mermaid-container');
            const displayContainer = document.getElementById('mermaid-display');
            if (!container || !displayContainer) return;

            const newCodeContent = \`${escapedCode}\`;

            // Store the new code in a hidden container
            container.textContent = newCodeContent;
            container.style.display = 'none';

            // Try to parse and validate
            window.mermaid.parse(newCodeContent, { suppressErrors: true })
              .then((result) => {
                if (result) {
                  // Valid syntax, try to render
                  return window.mermaid.render('mermaid-graph', newCodeContent);
                } else {
                  throw new Error('Invalid syntax');
                }
              })
              .then((result) => {
                // Rendering successful, update display
                displayContainer.innerHTML = result.svg;
                window.lastValidCode = newCodeContent;
                // Mark that we have a successful render and hide any errors
                window.hasSuccessfulRender = true;
                if (window.hideError) window.hideError();
              })
              .catch((error) => {
                // Either invalid syntax or rendering failed
                // Only start error timer if we've never had a successful render
                // This prevents showing errors after we've already shown a valid diagram
                if (!window.hasSuccessfulRender && !window.lastValidCode) {
                  if (window.showErrorAfterDelay) window.showErrorAfterDelay();
                }
              });
          } catch (error) {
            console.error('Update failed:', error);
            // Only show error if we've never had a successful render
            if (!window.hasSuccessfulRender && !window.lastValidCode) {
              if (window.showErrorAfterDelay) window.showErrorAfterDelay();
            }
          }
        })();
        true;
      `;

          webViewRef.current.injectJavaScript(jsCode);
        }

        setCurrentCode(newCode);
      },
      [currentCode]
    );

    useEffect(() => {
      if (code !== currentCode) {
        updateContent(code);
      }
    }, [code, currentCode, updateContent]);

    useImperativeHandle(
      ref,
      () => ({
        updateContent,
      }),
      [updateContent]
    );

    const htmlContent = useMemo(() => {
      return `
<!DOCTYPE html>
<html lang="">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        margin: 0;
        padding: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background-color: transparent;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 360px;
      }
      .mermaid {
        text-align: center;
      }
      svg {
        max-width: 100%;
        max-height: 360px;
        height: auto;
      }
      .error-message {
        color: #999;
        font-size: 14px;
        text-align: center;
        padding: 20px;
        display: none;
      }
      .error-message.show {
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="mermaid" id="mermaid-container" style="display: none;">
    ${initialCodeRef.current}
    </div>
    <div id="mermaid-display"></div>
    <div id="error-message" class="error-message">Invalid Mermaid syntax</div>
    
    <script type="module">
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

      mermaid.initialize({
        startOnLoad: true,
        theme: '${isDark ? 'dark' : 'default'}',
        securityLevel: 'loose',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      });

      window.mermaid = mermaid;
      window.lastValidCode = null;
      window.errorTimer = null;
      window.hasError = false;
      window.hasSuccessfulRender = false;
      window.showErrorAfterDelay = showErrorAfterDelay;
      window.hideError = hideError;

      // Override console.log to send logs to React Native
      const originalLog = console.log;
      console.log = function(...args) {
        originalLog.apply(console, args);
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
            }));
          }
        } catch (e) {
          originalLog('Failed to send log to RN:', e);
        }
      };

      // Function to show error message after delay
      function showErrorAfterDelay() {
        // Don't start error timer if we already have a successful render
        if (window.hasSuccessfulRender) {
          return;
        }
        
        // Clear any existing timer
        if (window.errorTimer) {
          clearTimeout(window.errorTimer);
        }
        
        // Set a new timer to show error after 1 second
        window.errorTimer = setTimeout(() => {
          // Only show error if we still don't have a successful render
          if (!window.hasSuccessfulRender) {
            document.getElementById('error-message').classList.add('show');
            document.getElementById('mermaid-display').style.display = 'none';
            window.hasError = true;
          }
        }, 1000);
      }

      // Function to hide an error message
      function hideError() {
        if (window.errorTimer) {
          clearTimeout(window.errorTimer);
          window.errorTimer = null;
        }
        document.getElementById('error-message').classList.remove('show');
        document.getElementById('mermaid-display').style.display = 'block';
        window.hasError = false;
      }

      // Set up parse error handler
      mermaid.parseError = function(err, _) {
        console.log('Mermaid parse error:', err);
      };

      // Validate and render initial content
      const initialCode = document.getElementById('mermaid-container').textContent.trim();
      const displayContainer = document.getElementById('mermaid-display');
      
      if (initialCode && displayContainer) {
        mermaid.parse(initialCode, { suppressErrors: true })
          .then((result) => {
            if (result) {
              return mermaid.render('mermaid-graph', initialCode);
            } else {
              throw new Error('Invalid initial syntax');
            }
          })
          .then((result) => {
            displayContainer.innerHTML = result.svg;
            window.lastValidCode = initialCode;
            window.hasSuccessfulRender = true;
            hideError();
          })
          .catch((error) => {
            console.log('Initial mermaid code error:', error.message);
            showErrorAfterDelay();
          });
      }
    </script>
  </body>
</html>`;
    }, [isDark]);

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        // console.log('[WebView]', JSON.parse(event.nativeEvent.data));
      } catch (error) {
        console.log('[WebView] Raw message:', event.nativeEvent.data);
      }
    };

    const styles = {
      webView: {
        height: 380,
        backgroundColor: 'transparent' as const,
      },
    };

    return (
      <>
        <TouchableOpacity
          onPress={() => setShowFullScreen(true)}
          activeOpacity={0.8}>
          <WebView
            ref={webViewRef}
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
            scrollEnabled={false}
            pointerEvents="none"
          />
        </TouchableOpacity>

        <MermaidFullScreenViewer
          visible={showFullScreen}
          onClose={() => setShowFullScreen(false)}
          code={currentCode}
        />
      </>
    );
  }
);

export default MermaidRenderer;
