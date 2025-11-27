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
import { useTheme, ColorScheme } from '../../theme';
import { getSearchProviderIcon } from '../../utils/SearchIconUtils';
import { getSearchProvider, saveSearchProvider } from '../../storage/StorageUtils';
import { SEARCH_PROVIDER_CONFIGS } from '../../websearch/constants/SearchProviderConstants';
import { SearchEngineOption } from '../../websearch/types';

interface WebSearchSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  iconPosition?: { x: number; y: number };
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MODAL_HEIGHT = 240;

export const WebSearchSelectionModal: React.FC<WebSearchSelectionModalProps> = ({
  visible,
  onClose,
  iconPosition = {
    x: SCREEN_WIDTH - 50,
    y: 70,
  },
}) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const { sendEvent } = useAppContext();
  const [selectedProvider, setSelectedProvider] = useState<SearchEngineOption>(
    getSearchProvider() as SearchEngineOption
  );

  const translateX = useSharedValue(100);
  const translateY = useSharedValue(100);
  const scale = useSharedValue(0.5);

  const startOpenAnimation = useCallback(() => {
    translateX.value = -4;
    translateY.value = 0;
    scale.value = 0;

    translateX.value = withTiming(-4, { duration: 250 });
    translateY.value = withTiming(-MODAL_HEIGHT, { duration: 250 });
    scale.value = withTiming(1, { duration: 250 });
  }, [scale, translateX, translateY]);

  useEffect(() => {
    if (visible) {
      setSelectedProvider(getSearchProvider() as SearchEngineOption);
      startOpenAnimation();
    }
  }, [startOpenAnimation, visible]);

  const startCloseAnimation = (callback: () => void) => {
    translateX.value = withTiming(-4, { duration: 250 });
    translateY.value = withTiming(0, { duration: 250 });
    scale.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(callback)();
    });
  };

  const handleClose = () => {
    startCloseAnimation(onClose);
  };

  const handleProviderSelect = (provider: SearchEngineOption) => {
    setSelectedProvider(provider);
    saveSearchProvider(provider);

    sendEvent('searchProviderChanged');

    startCloseAnimation(() => {
      onClose();
    });
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

  const renderProviderItem = ({
    item,
    index,
  }: {
    item: typeof SEARCH_PROVIDER_CONFIGS[0];
    index: number;
  }) => {
    const isSelected = selectedProvider === item.id;
    const isLastItem = index === SEARCH_PROVIDER_CONFIGS.length - 1;

    return (
      <TouchableOpacity
        style={[styles.providerItem, isLastItem && { borderBottomWidth: 0 }]}
        onPress={() => handleProviderSelect(item.id)}>
        <View style={styles.providerItemContent}>
          <Image
            source={getSearchProviderIcon(item.id, isDark)}
            style={styles.providerIcon}
          />
          <Text style={styles.providerName}>{item.name}</Text>
          {isSelected && (
            <Image
              source={
                isDark
                  ? require('../../assets/done_dark.png')
                  : require('../../assets/done.png')
              }
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
                {
                  position: 'absolute',
                  right: 10,
                  top: Math.max(iconPosition.y - 10, 10),
                  transformOrigin: 'right top',
                },
              ]}>
              <View style={styles.header}>
                <Text style={styles.title}>Web Search</Text>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={8}
                  style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={SEARCH_PROVIDER_CONFIGS}
                renderItem={renderProviderItem}
                keyExtractor={item => item.id}
                style={styles.providerList}
              />
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      width: 200,
      height: MODAL_HEIGHT,
      shadowColor: colors.shadow,
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
      color: colors.text,
    },
    closeButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 16,
      lineHeight: 18,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    providerList: {
      paddingRight: 8,
    },
    providerItem: {
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.borderLight,
    },
    providerItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 2,
    },
    providerIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 10,
    },
    providerName: {
      fontSize: 14,
      flex: 1,
      color: colors.text,
    },
    checkIcon: {
      width: 16,
      height: 16,
    },
  });
