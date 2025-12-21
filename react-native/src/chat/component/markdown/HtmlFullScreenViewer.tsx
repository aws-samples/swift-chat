import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { useTheme } from '../../../theme';
import { isMac } from '../../../App.tsx';
import AIWebView, { AIWebViewRef } from '../../../app/AIWebView';

interface HtmlFullScreenViewerProps {
  visible: boolean;
  onClose: () => void;
  code: string;
  baseUrl?: string;
}

const HtmlFullScreenViewer: React.FC<HtmlFullScreenViewerProps> = ({
  visible,
  onClose,
  code,
  baseUrl,
}) => {
  const { colors, isDark } = useTheme();
  const webViewRef = useRef<AIWebViewRef>(null);
  const [hasError, setHasError] = useState(false);
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const [isLandscape, setIsLandscape] = useState(
    isMac ? false : screenData.width > screenData.height
  );

  // Listen for orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
      setIsLandscape(isMac ? true : window.width > window.height);
    });

    return () => subscription?.remove();
  }, []);

  // Reset error state when modal opens
  useEffect(() => {
    if (visible) {
      setHasError(false);
    }
  }, [visible]);

  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        if (message.type === 'rendered') {
          setHasError(!message.success);
        }
      } catch (error) {
        console.log('[HtmlFullScreenViewer] Message parse error:', error);
      }
    },
    []
  );

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

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

        {/* WebView */}
        <View style={styles.webViewContainer}>
          <AIWebView
            ref={webViewRef}
            html={code}
            baseUrl={baseUrl}
            style={styles.webView}
            onMessage={handleWebViewMessage}
            onError={handleError}
            scrollEnabled={true}
            bounces={false}
          />
        </View>

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
