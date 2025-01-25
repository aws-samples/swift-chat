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
import { isMacCatalyst } from './utils/PlatformUtils';

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
  return (
    <Drawer.Navigator
      initialRouteName="Bedrock"
      screenOptions={{
        headerTintColor: 'black',
        headerTitleAlign: 'center',
        drawerStyle: { width: width },
        headerStyle: { height: isMac ? 66 : undefined },
        drawerType: isMac ? drawerType : 'slide',
      }}
      drawerContent={renderCustomDrawerContent}>
      <Drawer.Screen name="Bedrock" component={ChatScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
};
const AppNavigator = () => {
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
          },
          headerTitleAlign: 'center',
        }}
      />
      <Stack.Screen
        name="Prompt"
        component={PromptScreen}
        options={{
          title: 'System Prompt',
          contentStyle: { height: isMac ? 66 : undefined },
          headerTitleAlign: 'center',
        }}
      />
    </Stack.Navigator>
  );
};

const App = () => {
  return (
    <>
      <AppProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <NavigationContainer
          onStateChange={_ => {
            Keyboard.dismiss();
          }}>
          <AppNavigator />
        </NavigationContainer>
      </AppProvider>
      <Toast />
    </>
  );
};

export default App;
