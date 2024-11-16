import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { ChatMode } from '../../types/Chat.ts';

const isAndroid = Platform.OS === 'android';

interface EmptyChatComponentProps {
  chatMode: ChatMode;
}

export const EmptyChatComponent = ({
  chatMode,
}: EmptyChatComponentProps): React.ReactElement => {
  const source =
    chatMode === ChatMode.Text
      ? require('../../assets/bedrock.png')
      : require('../../assets/image.png');
  return (
    <View style={styles.emptyChatContainer}>
      <Image source={source} style={styles.emptyChatImage} />
    </View>
  );
};

const styles = StyleSheet.create({
  emptyChatContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  emptyChatImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    transform: [{ scaleY: -1 }, { scaleX: isAndroid ? -1 : 1 }],
  },
});
