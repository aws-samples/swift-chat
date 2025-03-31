import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import ImageSpinner from './ImageSpinner';
import { ChatMode, ModelTag } from '../../types/Chat.ts';
import { useNavigation } from '@react-navigation/native';
import { RouteParamList } from '../../types/RouteTypes.ts';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { getTextModel } from '../../storage/StorageUtils.ts';
import { DeepSeekModels } from '../../storage/Constants.ts';

const isAndroid = Platform.OS === 'android';
type NavigationProp = DrawerNavigationProp<RouteParamList>;

interface EmptyChatComponentProps {
  chatMode: ChatMode;
  isLoadingMessages?: boolean;
}

export const EmptyChatComponent = ({
  chatMode,
  isLoadingMessages = false,
}: EmptyChatComponentProps): React.ReactElement => {
  const navigation = useNavigation<NavigationProp>();
  const isDeepSeek = DeepSeekModels.some(
    model => model.modelId === getTextModel().modelId
  );
  const isOpenAI =
    getTextModel().modelTag === ModelTag.OpenAI ||
    getTextModel().modelId.includes('gpt');
  const isOpenAICompatible =
    getTextModel().modelTag === ModelTag.OpenAICompatible;
  const isOllama =
    getTextModel().modelTag === ModelTag.Ollama ||
    getTextModel().modelId.startsWith('ollama-');
  const modelIcon = isDeepSeek
    ? require('../../assets/deepseek.png')
    : isOpenAI
    ? require('../../assets/openai.png')
    : isOpenAICompatible
    ? require('../../assets/openai_api.png')
    : isOllama
    ? require('../../assets/ollama_white.png')
    : require('../../assets/bedrock.png');
  const source =
    chatMode === ChatMode.Text ? modelIcon : require('../../assets/image.png');
  return (
    <View style={styles.emptyChatContainer}>
      <TouchableOpacity
        onPress={() => {
          navigation.navigate('Settings', {});
        }}>
        {isLoadingMessages ? (
          <ImageSpinner
            visible={true}
            size={24}
            isRotate={true}
            source={require('../../assets/loading.png')}
          />
        ) : (
          <Image source={source} style={styles.emptyChatImage} />
        )}
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
