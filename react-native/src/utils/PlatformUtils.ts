import { NativeModules, Platform } from 'react-native';

const { PlatformModule } = NativeModules;

export const isMacCatalyst =
  Platform.OS === 'ios' && PlatformModule?.isMacCatalyst === true;

export const isAndroid = Platform.OS === 'android';
