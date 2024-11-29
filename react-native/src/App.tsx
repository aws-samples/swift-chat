import 'react-native-gesture-handler';
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import CustomDrawerContent from './history/CustomDrawerContent.tsx';
import { StatusBar, Keyboard, Dimensions } from 'react-native';
import ChatScreen from './chat/ChatScreen.tsx';
import { RouteParamList } from './types/RouteTypes.ts';
import { AppProvider } from './history/AppProvider.tsx';
import SettingsScreen from './settings/SettingsScreen.tsx';
import Toast from 'react-native-toast-message';
import TokenUsageScreen from './settings/TokenUsageScreen.tsx';

export const isMac = false;

const Drawer = createDrawerNavigator<RouteParamList>();
const renderCustomDrawerContent = (
  props: React.JSX.IntrinsicAttributes & DrawerContentComponentProps
) => <CustomDrawerContent {...props} />;

const App = () => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const minWidth = screenWidth > screenHeight ? screenHeight : screenWidth;
  const width = minWidth > 434 ? 360 : minWidth * 0.83;
  return (
    <>
      <AppProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <NavigationContainer
          onStateChange={_ => {
            Keyboard.dismiss();
          }}>
          <Drawer.Navigator
            initialRouteName="Bedrock"
            screenOptions={{
              headerTintColor: 'black',
              headerTitleAlign: 'center',
              drawerStyle: { width: width },
              headerStyle: { height: isMac ? 68 : undefined },
            }}
            drawerContent={renderCustomDrawerContent}>
            <Drawer.Screen name="Bedrock" component={ChatScreen} />
            <Drawer.Screen name="Settings" component={SettingsScreen} />
            <Drawer.Screen
              name="TokenUsage"
              component={TokenUsageScreen}
              options={{
                title: 'Usage',
              }}
            />
          </Drawer.Navigator>
        </NavigationContainer>
      </AppProvider>
      <Toast />
    </>
  );
};

export default App;
