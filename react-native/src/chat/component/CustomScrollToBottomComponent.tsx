import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export const CustomScrollToBottomComponent = (): React.ReactNode => {
  return (
    <View style={styles.scrollToBottomContainer}>
      <Image
        source={require('../../assets/scroll_down.png')}
        style={styles.scrollToBottomIcon}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  scrollToBottomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollToBottomIcon: {
    width: 20,
    height: 20,
  },
});
