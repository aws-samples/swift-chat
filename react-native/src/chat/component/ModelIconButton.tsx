import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { ModelTag } from '../../types/Chat';
import { getTextModel } from '../../storage/StorageUtils';
import { getModelTag } from '../../utils/ModelUtils.ts';

interface ModelIconButtonProps {
  onPress: () => void;
}

export const ModelIconButton: React.FC<ModelIconButtonProps> = ({
  onPress,
}) => {
  // Directly get the current model on each render
  const currentModelTag = getModelTag(getTextModel());

  const modelIcon =
    currentModelTag === ModelTag.DeepSeek
      ? require('../../assets/deepseek.png')
      : currentModelTag === ModelTag.OpenAICompatible
      ? require('../../assets/openai_api.png')
      : currentModelTag === ModelTag.OpenAI
      ? require('../../assets/openai.png')
      : currentModelTag === ModelTag.Ollama
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
