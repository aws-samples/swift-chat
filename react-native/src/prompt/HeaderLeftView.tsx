import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteParamList } from '../types/RouteTypes.ts';
import { useTheme } from '../theme';

type NavigationProp = DrawerNavigationProp<RouteParamList>;

export const HeaderLeftView = (navigation: NavigationProp) => {
  const { isDark } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={styles.headerContainer}>
      <Image
        source={
          isDark
            ? require('../assets/back_dark.png')
            : require('../assets/back.png')
        }
        style={styles.headerImage}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    marginLeft: -10,
    paddingRight: 16,
    padding: 10,
  },
  headerImage: { width: 20, height: 20 },
});
