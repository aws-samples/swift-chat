import { LogBox } from 'react-native';

/**
 * Configure global error handling and warning suppression
 */
export const configureErrorHandling = () => {
  LogBox.ignoreLogs([/Invalid\s+responseType:\s+blob/i]);
};
