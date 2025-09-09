import React, { useMemo, useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { ViewStyle } from 'react-native';

interface MermaidRendererProps {
  code: string;
  style?: ViewStyle;
}

const MermaidRenderer = forwardRef<any, MermaidRendererProps>(({ code, style }, ref) => {
  const [webViewHeight, setWebViewHeight] = useState(200);
  const [currentCode, setCurrentCode] = useState(code);
  const webViewRef = useRef<WebView>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  
  useEffect(() => {
    if (code !== currentCode) {
      setCurrentCode(code);
    }
  }, [code, currentCode]);

  const updateContent = useCallback((newCode: string) => {
    if (newCode === currentCode) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

    if (timeSinceLastUpdate < 200) {
      setTimeout(() => updateContent(newCode), 200 - timeSinceLastUpdate);
      return;
    }

    lastUpdateTimeRef.current = now;

    if (webViewRef.current) {
      const escapedCode = newCode.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\n/g, '\\n');
      const jsCode = `
        (function() {
          try {
            const container = document.getElementById('mermaid-container');
            if (container) {
              container.innerHTML = \`${escapedCode}\`;
              window.mermaid.run().then(() => {
                window.updateHeight();
              }).catch((error) => {
                console.error('Mermaid rendering failed:', error);
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'height',
                  height: 200
                }));
              });
            }
          } catch (error) {
            console.error('Update failed:', error);
          }
        })();
      `;
      
      webViewRef.current.injectJavaScript(jsCode);
    }
    
    setCurrentCode(newCode);
  }, [currentCode]);

  useImperativeHandle(ref, () => ({
    updateContent
  }), [updateContent]);

  const htmlContent = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
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
      }
      .mermaid {
        text-align: center;
      }
      svg {
        max-width: 100%;
        max-height: 400px;
        height: auto;
      }
    </style>
  </head>
  <body>
    <div class="mermaid" id="mermaid-container">
    ${currentCode}
    </div>
    
    <script type="module">
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
      
      mermaid.initialize({ 
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      });

      window.mermaid = mermaid;

      window.updateHeight = () => {
        setTimeout(() => {
          const container = document.getElementById('mermaid-container');
          const svg = container.querySelector('svg');
          if (svg) {
            const svgHeight = svg.getBoundingClientRect().height;
            const totalHeight = svgHeight + 20; // 加上padding
            
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'height',
              height: Math.max(totalHeight, 100)
            }));
          }
        }, 100);
      };

      mermaid.run().then(window.updateHeight).catch((error) => {
        console.error('Mermaid rendering failed:', error);
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'height',
          height: 200
        }));
      });
    </script>
  </body>
</html>`;
  }, [currentCode]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height' && data.height) {
        setWebViewHeight(Math.min(data.height, 500));
      }
    } catch (error) {
    }
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ html: htmlContent }}
      style={[{ height: webViewHeight, backgroundColor: 'transparent' }, style]}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      allowFileAccess={true}
      allowUniversalAccessFromFileURLs={true}
      mixedContentMode="compatibility"
      originWhitelist={['*']}
      scalesPageToFit={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      onMessage={handleMessage}
      scrollEnabled={false}
    />
  );
});

export default MermaidRenderer;