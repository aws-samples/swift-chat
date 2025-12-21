import React, {
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  ViewStyle,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { ColorScheme, useTheme } from '../../../theme';
import HtmlFullScreenViewer from './HtmlFullScreenViewer';
import RNFS from 'react-native-fs';
import {
  saveApp,
  generateAppId,
  getSessionId,
} from '../../../storage/StorageUtils';
import { SavedApp } from '../../../types/Chat';
import AIWebView, { AIWebViewRef } from '../../../app/AIWebView';

interface HtmlPreviewRendererProps {
  code: string;
  style?: ViewStyle;
}

interface HtmlPreviewRendererRef {
  updateContent: (newCode: string) => void;
}

// App screenshots directory
const APP_SCREENSHOTS_DIR = `${RNFS.DocumentDirectoryPath}/app`;

const HtmlPreviewRenderer = forwardRef<
  HtmlPreviewRendererRef,
  HtmlPreviewRendererProps
>(({ code, style }, ref) => {
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [appName, setAppName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const webViewRef = useRef<AIWebViewRef>(null);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Use current session ID for localStorage sharing between preview and fullscreen
  const baseUrl = `https://html-session-${getSessionId()}.local/`;

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

  // Ensure app directory exists
  const ensureAppDir = async () => {
    const exists = await RNFS.exists(APP_SCREENSHOTS_DIR);
    if (!exists) {
      await RNFS.mkdir(APP_SCREENSHOTS_DIR);
    }
  };

  // Capture screenshot using html2canvas
  const captureScreenshot = useCallback(() => {
    return `
      (function() {
        // Load html2canvas from CDN
        if (typeof html2canvas === 'undefined') {
          var script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = function() {
            captureNow();
          };
          script.onerror = function() {
            // Fallback if CDN fails
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'screenshot_error',
              message: 'Failed to load html2canvas'
            }));
          };
          document.head.appendChild(script);
        } else {
          captureNow();
        }

        function captureNow() {
          var pixelRatio = window.devicePixelRatio || 1;
          var captureWidth = Math.min(document.body.scrollWidth || window.innerWidth, 800);
          var captureHeight = Math.min(document.body.scrollHeight || window.innerHeight, 800);

          html2canvas(document.body, {
            backgroundColor: null,
            useCORS: true,
            allowTaint: true,
            scale: Math.min(pixelRatio, 1),
            width: captureWidth,
            height: captureHeight,
            windowWidth: captureWidth,
            windowHeight: captureHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0
          }).then(function(canvas) {
            var dataURL = canvas.toDataURL('image/jpeg', 0.9);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'screenshot_success',
              data: dataURL
            }));
          }).catch(function(error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'screenshot_error',
              message: error.message || 'Screenshot failed'
            }));
          });
        }
      })();
      true;
    `;
  }, []);

  const handleScreenshotMessage = useCallback(
    async (data: string) => {
      try {
        await ensureAppDir();

        const appId = generateAppId();
        const base64Data = data.replace(/^data:image\/(png|jpeg);base64,/, '');
        const screenshotFileName = `${appId}.jpg`;
        const screenshotFullPath = `${APP_SCREENSHOTS_DIR}/${screenshotFileName}`;

        await RNFS.writeFile(screenshotFullPath, base64Data, 'base64');

        // Store relative path for iOS (to survive app updates), full file:// URI for Android
        const storedPath =
          Platform.OS === 'android'
            ? `file://${screenshotFullPath}`
            : `app/${screenshotFileName}`;

        const app: SavedApp = {
          id: appId,
          name: appName.trim(),
          htmlCode: code,
          screenshotPath: storedPath,
          createdAt: Date.now(),
        };

        saveApp(app);

        setIsSaving(false);
        setShowSaveModal(false);
        setAppName('');
        Alert.alert('Success', `App "${appName}" saved successfully!`);
      } catch (error) {
        console.error('[HtmlPreview] Save error:', error);
        setIsSaving(false);
        Alert.alert('Error', 'Failed to save app');
      }
    },
    [appName, code]
  );

  const handleSaveApp = useCallback(async () => {
    if (!appName.trim()) {
      Alert.alert('Error', 'Please enter an app name');
      return;
    }
    if (appName.length > 20) {
      Alert.alert('Error', 'App name must be 20 characters or less');
      return;
    }

    setIsSaving(true);

    // Capture screenshot using html2canvas
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(captureScreenshot());
    }
  }, [appName, captureScreenshot]);

  const handleSaveWithoutScreenshot = useCallback(async () => {
    try {
      await ensureAppDir();

      const appId = generateAppId();

      const app: SavedApp = {
        id: appId,
        name: appName.trim(),
        htmlCode: code,
        screenshotPath: undefined,
        createdAt: Date.now(),
      };

      saveApp(app);

      setIsSaving(false);
      setShowSaveModal(false);
      setAppName('');
      Alert.alert('Success', `App "${appName}" saved (without preview)`);
    } catch (error) {
      console.error('[HtmlPreview] Save error:', error);
      setIsSaving(false);
      Alert.alert('Error', 'Failed to save app');
    }
  }, [appName, code]);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
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

        if (message.type === 'screenshot_success') {
          handleScreenshotMessage(message.data);
        }

        if (message.type === 'screenshot_error') {
          console.error('[HtmlPreview] Screenshot error:', message.message);
          // Save without screenshot
          handleSaveWithoutScreenshot();
        }
      } catch (error) {
        console.log('[HtmlPreview] Raw message:', event.nativeEvent.data);
      }
    },
    [handleScreenshotMessage, handleSaveWithoutScreenshot]
  );

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          onPress={() => setShowFullScreen(true)}
          activeOpacity={0.8}
          style={styles.webViewContainer}>
          <AIWebView
            ref={webViewRef}
            html={code}
            baseUrl={baseUrl}
            style={{ ...styles.webView, ...style }}
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

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => setShowSaveModal(true)}>
          <Image
            source={require('../../../assets/download.png')}
            style={styles.saveIcon}
          />
        </TouchableOpacity>
      </View>

      {/* Save Modal */}
      <Modal
        visible={showSaveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSaveModal(false)}>
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Save App</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter app name (max 20 chars)"
              placeholderTextColor={colors.textSecondary}
              value={appName}
              onChangeText={text => setAppName(text.slice(0, 20))}
              maxLength={20}
              autoFocus={true}
              returnKeyType="done"
              onSubmitEditing={handleSaveApp}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowSaveModal(false);
                  setAppName('');
                }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  isSaving && styles.modalButtonDisabled,
                ]}
                onPress={handleSaveApp}
                disabled={isSaving}>
                <Text style={styles.modalSaveText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <HtmlFullScreenViewer
        visible={showFullScreen}
        onClose={() => setShowFullScreen(false)}
        code={code}
        baseUrl={baseUrl}
      />
    </>
  );
});

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      position: 'relative' as const,
    },
    webViewContainer: {
      position: 'relative' as const,
    },
    webView: {
      height: 480,
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
    saveButton: {
      position: 'absolute' as const,
      bottom: 12,
      right: 12,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    saveIcon: {
      width: 22,
      height: 22,
      tintColor: '#ffffff',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 20,
      width: '80%',
      maxWidth: 320,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center' as const,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.input,
      marginBottom: 16,
    },
    modalButtons: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
    },
    modalCancelButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.border,
      marginRight: 8,
    },
    modalCancelText: {
      color: colors.text,
      textAlign: 'center' as const,
      fontSize: 16,
      fontWeight: '500' as const,
    },
    modalSaveButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.primary,
      marginLeft: 8,
    },
    modalButtonDisabled: {
      opacity: 0.6,
    },
    modalSaveText: {
      color: '#ffffff',
      textAlign: 'center' as const,
      fontSize: 16,
      fontWeight: '500' as const,
    },
  });

export default HtmlPreviewRenderer;
