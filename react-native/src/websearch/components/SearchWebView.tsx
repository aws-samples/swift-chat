/**
 * SearchWebView Component
 * 封装所有WebView搜索相关的UI和事件处理逻辑
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../theme';
import { useAppContext } from '../../history/AppProvider';
import { webViewSearchService } from '../services/WebViewSearchService';

export const SearchWebView: React.FC = () => {
  const { colors } = useTheme();
  const { event, sendEvent } = useAppContext();
  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [showWebView, setShowWebView] = useState<boolean>(false);
  const loadEndCalledRef = useRef<boolean>(false);
  const onWebViewLoadEndRef = useRef<(() => void) | null>(null);
  const onCaptchaClosedRef = useRef<(() => void) | null>(null);

  // 初始化 webViewSearchService
  useEffect(() => {
    console.log('[SearchWebView] Initializing webViewSearchService with sendEvent');
    webViewSearchService.setSendEvent(sendEvent);
  }, [sendEvent]);

  // 处理来自 webViewSearchService 的事件
  useEffect(() => {
    if (event && event.event.startsWith('webview:')) {
      // 处理 WebView 消息
      if (event.event === 'webview:message' && event.params?.data) {
        webViewSearchService.handleMessage(event.params.data);
      }
      // 转发其他事件给 service
      else {
        webViewSearchService.handleEvent(event.event, event.params);
      }
    }
  }, [event]);

  // 监听并处理WebView相关事件
  useEffect(() => {
    if (!event) return;

    switch (event.event) {
      case 'webview:loadUrl':
        if (event.params?.url) {
          console.log('[SearchWebView] Loading URL in VISIBLE WebView (DEBUG MODE):', event.params.url);
          loadEndCalledRef.current = false;
          setCurrentUrl(event.params.url);
          setShowWebView(true); // DEBUG: 显示WebView用于调试
        }
        break;

      case 'webview:injectScript':
        if (event.params?.script) {
          console.log('[SearchWebView] Injecting script into WebView');
          webViewRef.current?.injectJavaScript(event.params.script);
        }
        break;

      case 'webview:showCaptcha':
        console.log('[SearchWebView] Showing WebView for CAPTCHA verification');
        setShowWebView(true);
        break;

      case 'webview:hide':
        console.log('[SearchWebView] Hiding WebView');
        setShowWebView(false);
        break;

      case 'webview:setLoadEndCallback':
        // 保存加载完成回调
        onWebViewLoadEndRef.current = event.params?.data ? () => {
          sendEvent('webview:loadEndTriggered');
        } : null;
        break;

      case 'webview:setCaptchaClosedCallback':
        // 保存验证码关闭回调
        onCaptchaClosedRef.current = event.params?.data ? () => {
          sendEvent('webview:captchaClosed');
        } : null;
        break;
    }
  }, [event, sendEvent]);

  // WebView加载完成回调
  const handleLoadEnd = () => {
    const logType = showWebView ? '' : ' (hidden)';
    console.log(`[SearchWebView] WebView load complete${logType}`);
    if (!loadEndCalledRef.current && onWebViewLoadEndRef.current) {
      loadEndCalledRef.current = true;
      console.log('[SearchWebView] First load complete, triggering callback');
      onWebViewLoadEndRef.current();
    }
  };

  // WebView消息回调
  const handleMessage = (data: string) => {
    sendEvent('webview:message', { data });
  };

  // WebView错误回调
  const handleError = (nativeEvent: any) => {
    console.error('[SearchWebView] WebView error:', nativeEvent);
  };

  // 用户点击关闭按钮
  const handleClose = () => {
    setShowWebView(false);
    if (onCaptchaClosedRef.current) {
      onCaptchaClosedRef.current();
    }
  };

  if (!currentUrl) {
    return null;
  }

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      // 隐藏模式：移到屏幕外，零尺寸，透明
      // 显示模式：全屏遮罩
      ...(showWebView ? {
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
      } : {
        left: -10000,
        width: 1,
        height: 1,
        backgroundColor: 'transparent',
        zIndex: -1,
        opacity: 0,
        pointerEvents: 'none',
      })
    }}>
      {/* 模态框容器 - 只在showWebView时显示标题栏等UI */}
      {showWebView ? (
        <View style={{
          width: '90%',
          height: '80%',
          backgroundColor: colors.background,
          borderRadius: 12,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}>
          {/* 标题栏 */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            backgroundColor: colors.border,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
              请完成验证
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={{
                padding: 8,
                borderRadius: 4,
                backgroundColor: colors.background,
              }}
            >
              <Text style={{ fontSize: 16, color: colors.text }}>✕</Text>
            </TouchableOpacity>
          </View>
          {/* WebView容器 */}
          <View style={{ flex: 1 }}>
            <WebView
              ref={webViewRef}
              source={{ uri: currentUrl }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              style={{ flex: 1 }}
              onMessage={event => handleMessage(event.nativeEvent.data)}
              onLoadEnd={handleLoadEnd}
              onError={syntheticEvent => handleError(syntheticEvent.nativeEvent)}
              userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            />
          </View>
        </View>
      ) : (
        // 隐藏模式：只渲染WebView，无其他UI
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={{ width: 800, height: 600 }}
          onMessage={event => handleMessage(event.nativeEvent.data)}
          onLoadEnd={handleLoadEnd}
          onError={syntheticEvent => handleError(syntheticEvent.nativeEvent)}
          userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        />
      )}
    </View>
  );
};
