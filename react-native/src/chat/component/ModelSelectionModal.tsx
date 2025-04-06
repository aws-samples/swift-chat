import React, { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../../history/AppProvider';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  TouchableWithoutFeedback,
  FlatList,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Model, ModelTag } from '../../types/Chat';
import {
  getTextModel,
  saveTextModel,
  updateTextModelUsageOrder,
  getMergedModelOrder,
} from '../../storage/StorageUtils';
import { DeepSeekModels } from '../../storage/Constants';

interface ModelSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  iconPosition?: { x: number; y: number };
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MODAL_HEIGHT = 360;

export const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({
  visible,
  onClose,
  iconPosition = {
    x: SCREEN_WIDTH - 50,
    y: 70,
  },
}) => {
  const { sendEvent } = useAppContext();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model>(getTextModel());

  // Animation values
  const translateX = useSharedValue(100);
  const translateY = useSharedValue(100);
  const scale = useSharedValue(0.5);

  const startOpenAnimation = useCallback(() => {
    // Animate from icon position to modal position
    translateX.value = -4;
    translateY.value = 0;
    scale.value = 0;

    translateX.value = withTiming(-4, { duration: 250 });
    translateY.value = withTiming(-MODAL_HEIGHT, { duration: 250 });
    scale.value = withTiming(1, { duration: 250 });
  }, [scale, translateX, translateY]);

  useEffect(() => {
    if (visible) {
      // Load models and start animation
      loadModels();
      startOpenAnimation();
    }
  }, [startOpenAnimation, visible]);

  const loadModels = () => {
    // Get merged models (combines history with current available models)
    const mergedModels = getMergedModelOrder();
    setModels(mergedModels);
    setSelectedModel(getTextModel());
  };

  const startCloseAnimation = (callback: () => void) => {
    // Animate back to icon position
    translateX.value = withTiming(-4, { duration: 250 });
    translateY.value = withTiming(0, { duration: 250 }); // Changed from -20 to -150
    scale.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(callback)();
    });
  };

  const handleClose = () => {
    startCloseAnimation(onClose);
  };

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model);
    saveTextModel(model);

    // Update model order (move selected model to the top of history)
    updateTextModelUsageOrder(model);

    // Send model changed event
    sendEvent('modelChanged');

    // Get updated merged model list
    const mergedModels = getMergedModelOrder();
    setModels(mergedModels);

    // Close modal and notify parent
    startCloseAnimation(() => {
      onClose();
    });
  };

  const getModelIcon = (model: Model) => {
    const isDeepSeek = DeepSeekModels.some(m => m.modelId === model.modelId);
    const isOpenAICompatible = model.modelTag === ModelTag.OpenAICompatible;
    const isOpenAI =
      model.modelTag === ModelTag.OpenAI || model.modelId.includes('gpt');
    const isOllama =
      model.modelTag === ModelTag.Ollama || model.modelId.startsWith('ollama-');

    return isDeepSeek
      ? require('../../assets/deepseek.png')
      : isOpenAICompatible
      ? require('../../assets/openai_api.png')
      : isOpenAI
      ? require('../../assets/openai.png')
      : isOllama
      ? require('../../assets/ollama_white.png')
      : require('../../assets/bedrock.png');
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const renderModelItem = ({ item, index }: { item: Model; index: number }) => {
    const isSelected = selectedModel.modelId === item.modelId;
    const isLastItem = index === models.length - 1;

    return (
      <TouchableOpacity
        // eslint-disable-next-line react-native/no-inline-styles
        style={[styles.modelItem, isLastItem && { borderBottomWidth: 0 }]}
        onPress={() => handleModelSelect(item)}>
        <View style={styles.modelItemContent}>
          <Image source={getModelIcon(item)} style={styles.modelIcon} />
          <Text style={styles.modelName}>{item.modelName}</Text>
          {isSelected && (
            <Image
              source={require('../../assets/done.png')}
              style={styles.checkIcon}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent={true}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                animatedStyle,
                // eslint-disable-next-line react-native/no-inline-styles
                {
                  position: 'absolute',
                  right: 10,
                  top: Math.max(iconPosition.y - 10, 10),
                  transformOrigin: 'right top',
                },
              ]}>
              <View style={styles.header}>
                <Text style={styles.title}>Select Model</Text>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={8}
                  style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={models}
                renderItem={renderModelItem}
                keyExtractor={item => item.modelId}
                style={styles.modelList}
              />
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    width: 240,
    height: MODAL_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
  },
  closeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    lineHeight: 18,
    textAlign: 'center',
    color: '#333',
  },
  modelList: {
    paddingRight: 8,
  },
  modelItem: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E8E8',
  },
  modelItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  modelIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  modelName: {
    fontSize: 14,
    flex: 1,
    color: '#333',
  },
  checkIcon: {
    width: 16,
    height: 16,
  },
});
