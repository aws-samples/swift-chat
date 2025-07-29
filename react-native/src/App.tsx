import 'react-native-gesture-handler';
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import CustomDrawerContent from './history/CustomDrawerContent.tsx';
import { Dimensions, Keyboard, StatusBar } from 'react-native';
import ChatScreen from './chat/ChatScreen.tsx';
import { RouteParamList } from './types/RouteTypes.ts';
import { AppProvider, useAppContext } from './history/AppProvider.tsx';
import SettingsScreen from './settings/SettingsScreen.tsx';
import Toast from 'react-native-toast-message';
import TokenUsageScreen from './settings/TokenUsageScreen.tsx';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PromptScreen from './prompt/PromptScreen.tsx';
import { isAndroid, isMacCatalyst } from './utils/PlatformUtils';
import { ThemeProvider, useTheme } from './theme';
import { configureErrorHandling } from './utils/ErrorUtils';
import { migrateOpenAICompatConfig } from './storage/StorageUtils.ts';

export const isMac = isMacCatalyst;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const minWidth = screenWidth > screenHeight ? screenHeight : screenWidth;
const width = minWidth > 434 ? 300 : minWidth * 0.83;

const Drawer = createDrawerNavigator<RouteParamList>();
const Stack = createNativeStackNavigator();

const renderCustomDrawerContent = (
  props: React.JSX.IntrinsicAttributes & DrawerContentComponentProps
) => <CustomDrawerContent {...props} />;

const DrawerNavigator = () => {
  const { drawerType } = useAppContext();
  const { colors, isDark } = useTheme();
  return (
    <Drawer.Navigator
      initialRouteName="Bedrock"
      screenOptions={{
        overlayColor: isDark ? 'rgba(255, 255, 255, 0.1)' : undefined,
        headerTintColor: colors.text,
        headerTitleAlign: 'center',
        drawerStyle: {
          width: width,
          backgroundColor: colors.background,
          borderRightWidth: isMac ? 1 : isAndroid ? 0.3 : 0,
          borderRightColor: colors.border,
        },
        headerStyle: {
          height: isMac ? 66 : undefined,
          backgroundColor: colors.background,
          borderBottomWidth: isDark ? 0.3 : undefined,
          borderBottomColor: isDark ? colors.chatScreenSplit : undefined,
        },
        drawerType: isMac ? drawerType : 'slide',
      }}
      drawerContent={renderCustomDrawerContent}>
      <Drawer.Screen name="Bedrock" component={ChatScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
};
const AppNavigator = () => {
  const { colors } = useTheme();
  return (
    <Stack.Navigator initialRouteName="Drawer" screenOptions={{}}>
      <Stack.Screen
        name="Drawer"
        component={DrawerNavigator}
        options={{ headerShown: false, headerLargeTitleShadowVisible: false }}
      />
      <Stack.Screen
        name="TokenUsage"
        component={TokenUsageScreen}
        options={{
          title: 'Usage',
          contentStyle: {
            height: isMac ? 66 : undefined,
            backgroundColor: colors.background,
          },
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen
        name="Prompt"
        component={PromptScreen}
        options={{
          title: 'System Prompt',
          contentStyle: {
            height: isMac ? 66 : undefined,
            backgroundColor: colors.background,
          },
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
    </Stack.Navigator>
  );
};

const AppWithTheme = () => {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <NavigationContainer
        onStateChange={_ => {
          Keyboard.dismiss();
        }}>
        <AppNavigator />
      </NavigationContainer>
    </>
  );
};

const App = () => {
  React.useEffect(() => {
    configureErrorHandling();
    migrateOpenAICompatConfig();
  }, []);

  return (
    <>
      <ThemeProvider>
        <AppProvider>
          <AppWithTheme />
        </AppProvider>
      </ThemeProvider>
      <Toast />
    </>
  );
};

export default App;
