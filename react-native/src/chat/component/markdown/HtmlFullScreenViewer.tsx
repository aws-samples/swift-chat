import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  PanGestureHandler,
  PinchGestureHandler,
  PanGestureHandlerGestureEvent,
  PinchGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../../theme';
import { isMac } from '../../../App.tsx';

interface HtmlFullScreenViewerProps {
  visible: boolean;
  onClose: () => void;
  code: string;
}

const HtmlFullScreenViewer: React.FC<HtmlFullScreenViewerProps> = ({
  visible,
  onClose,
  code,
}) => {
  const { colors, isDark } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [hasError, setHasError] = useState(false);
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const [isLandscape, setIsLandscape] = useState(
    isMac ? false : screenData.width > screenData.height
  );

  // Animation values for pan and zoom
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Listen for orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
      setIsLandscape(isMac ? true : window.width > window.height);
    });

    return () => subscription?.remove();
  }, []);

  // Reset transforms when modal opens
  useEffect(() => {
    if (visible) {
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
      baseScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      setHasError(false);
    }
  }, [
    visible,
    translateX,
    translateY,
    scale,
    baseScale,
    savedTranslateX,
    savedTranslateY,
  ]);

  const pinchHandler =
    useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
      onStart: () => {
        baseScale.value = scale.value;
      },
      onActive: event => {
        scale.value = Math.max(0.5, Math.min(baseScale.value * event.scale, 5));
      },
      onEnd: () => {
        if (scale.value < 1) {
          scale.value = withSpring(1);
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
        }
      },
    });

  const panHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    },
    onActive: event => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    },
    onEnd: () => {
      // Only spring back to center if scale is 1 or less
      if (scale.value <= 1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Save the final position for next pan
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'rendered') {
        setHasError(!message.success);
      }
    } catch (error) {
      console.log('[HtmlFullScreenViewer] Message parse error:', error);
    }
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  // Inject error handling script into the HTML
  const htmlContent = useMemo(() => {
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

    if (code.includes('</body>')) {
      return code.replace('</body>', `${errorHandlingScript}</body>`);
    } else if (code.includes('</html>')) {
      return code.replace('</html>', `${errorHandlingScript}</html>`);
    } else {
      return code + errorHandlingScript;
    }
  }, [code]);

  const styles = StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: isDark ? '#000000' : '#ffffff',
    },
    closeButtonTopLeft: {
      position: 'absolute',
      top:
        Platform.OS === 'ios'
          ? isLandscape
            ? 40
            : 60
          : (StatusBar.currentHeight || 20) + (isLandscape ? 10 : 20),
      left: isLandscape ? 40 : 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(50, 50, 50, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    closeButtonX: {
      fontSize: 20,
      fontWeight: '400',
      marginBottom: -2,
      color: '#ffffff',
      lineHeight: 20,
    },
    webViewContainer: {
      flex: 1,
      backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
    },
    webView: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    errorContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)',
      zIndex: 998,
    },
    errorText: {
      marginTop: 10,
      fontSize: 16,
      color: colors.text,
    },
  });

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent={true}
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}>
      <View style={styles.modal}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent={true}
        />

        {/* Close button in top-left */}
        <TouchableOpacity style={styles.closeButtonTopLeft} onPress={onClose}>
          <Text style={styles.closeButtonX}>×</Text>
        </TouchableOpacity>

        {/* WebView with gesture handling */}
        <PanGestureHandler onGestureEvent={panHandler}>
          <Animated.View style={styles.webViewContainer}>
            <PinchGestureHandler onGestureEvent={pinchHandler}>
              <Animated.View style={[styles.webViewContainer, animatedStyle]}>
                <WebView
                  ref={webViewRef}
                  source={{ html: htmlContent }}
                  style={styles.webView}
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
                  onMessage={handleWebViewMessage}
                  onError={handleError}
                  scrollEnabled={true}
                  bounces={false}
                  decelerationRate="normal"
                />
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>

        {/* Error overlay */}
        {hasError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{'Invalid HTML'}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default HtmlFullScreenViewer;
