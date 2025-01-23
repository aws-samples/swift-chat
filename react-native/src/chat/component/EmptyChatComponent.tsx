import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChatMode } from '../../types/Chat.ts';
import { useNavigation } from '@react-navigation/native';
import { RouteParamList } from '../../types/RouteTypes.ts';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { getTextModel } from '../../storage/StorageUtils.ts';

const isAndroid = Platform.OS === 'android';
type NavigationProp = DrawerNavigationProp<RouteParamList>;

interface EmptyChatComponentProps {
  chatMode: ChatMode;
}

export const EmptyChatComponent = ({
  chatMode,
}: EmptyChatComponentProps): React.ReactElement => {
  const navigation = useNavigation<NavigationProp>();
  const isDeepSeek = getTextModel().modelId.includes('deepseek');
  const isOpenAI = getTextModel().modelId.includes('gpt');
  const isOllama = getTextModel().modelId.startsWith('ollama-');
  const modelIcon = isDeepSeek
    ? require('../../assets/deepseek.png')
    : isOpenAI
    ? require('../../assets/openai.png')
    : isOllama
    ? require('../../assets/ollama-white.png')
    : require('../../assets/bedrock.png');
  const source =
    chatMode === ChatMode.Text ? modelIcon : require('../../assets/image.png');
  return (
    <View style={styles.emptyChatContainer}>
      <TouchableOpacity
        onPress={() => {
          navigation.navigate('Settings', {});
        }}>
        <Image source={source} style={styles.emptyChatImage} />
      </TouchableOpacity>
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
