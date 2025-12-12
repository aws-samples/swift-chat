import React, { useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteParamList } from '../types/RouteTypes';
import { HeaderLeftView } from '../prompt/HeaderLeftView';
import { useTheme, ColorScheme } from '../theme';
import { injectErrorScript, commonWebViewProps } from '../chat/component/markdown/htmlUtils';

type NavigationProp = DrawerNavigationProp<RouteParamList>;
type AppViewerRouteProp = RouteProp<RouteParamList, 'AppViewer'>;

function AppViewerScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<AppViewerRouteProp>();
  const { app } = route.params;
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  const headerLeft = useCallback(
    () => HeaderLeftView(navigation, isDark),
    [navigation, isDark]
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft,
    });
  }, [navigation, headerLeft]);

  const htmlContent = useMemo(() => injectErrorScript(app.htmlCode), [app.htmlCode]);

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webView}
        {...commonWebViewProps}
        scrollEnabled={true}
        bounces={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        contentInsetAdjustmentBehavior="never"
      />
    </View>
  );
}

const createStyles = (_colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    webView: {
      flex: 1,
      backgroundColor: '#000000',
    },
  });

export default AppViewerScreen;
