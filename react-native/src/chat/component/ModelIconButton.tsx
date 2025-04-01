import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { ModelTag } from '../../types/Chat';
import { DeepSeekModels } from '../../storage/Constants';
import { getTextModel } from '../../storage/StorageUtils';

interface ModelIconButtonProps {
  onPress: () => void;
}

export const ModelIconButton: React.FC<ModelIconButtonProps> = ({
  onPress,
}) => {
  // Directly get the current model on each render
  const currentModel = getTextModel();

  const isDeepSeek = DeepSeekModels.some(
    model => model.modelId === currentModel.modelId
  );
  const isOpenAICompatible =
    currentModel.modelTag === ModelTag.OpenAICompatible;
  const isOpenAI =
    currentModel.modelTag === ModelTag.OpenAI ||
    currentModel.modelId.includes('gpt');
  const isOllama =
    currentModel.modelTag === ModelTag.Ollama ||
    currentModel.modelId.startsWith('ollama-');

  const modelIcon = isDeepSeek
    ? require('../../assets/deepseek.png')
    : isOpenAICompatible
    ? require('../../assets/openai_api.png')
    : isOpenAI
    ? require('../../assets/openai.png')
    : isOllama
    ? require('../../assets/ollama_white.png')
    : require('../../assets/bedrock.png');

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Image source={modelIcon} style={styles.icon} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 52,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 5,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: -6,
  },
});
