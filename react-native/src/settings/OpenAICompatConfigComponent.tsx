import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { OpenAICompatConfig } from '../types/Chat.ts';
import CustomTextInput from './CustomTextInput.tsx';
import { useTheme, ColorScheme } from '../theme';

interface OpenAICompatConfigComponentProps {
  config: OpenAICompatConfig;
  index: number;
  isFirst: boolean;
  onUpdate: (
    id: string,
    field: keyof OpenAICompatConfig,
    value: string
  ) => void;
  onRemove: (id: string) => void;
  isDark: boolean;
}

export default function OpenAICompatConfigComponent({
  config,
  index,
  isFirst,
  onUpdate,
  onRemove,
  isDark: _isDark,
}: OpenAICompatConfigComponentProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const displayName = isFirst
    ? 'OpenAI Compatible'
    : `OpenAI Compatible ${index + 1}`;

  return (
    <View style={styles.container}>
      {!isFirst && (
        <View style={styles.headerContainer}>
          <Text style={[styles.label, styles.headerLabel]}>{displayName}</Text>
          {!isFirst && (
            <TouchableOpacity
              onPress={() => onRemove(config.id)}
              style={styles.removeButton}>
              <Image
                style={styles.removeIcon}
                source={require('../assets/delete.png')}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      <CustomTextInput
        label="Base URL"
        value={config.baseUrl}
        onChangeText={value => onUpdate(config.id, 'baseUrl', value.trim())}
        placeholder="Enter Base URL"
        secureTextEntry={false}
      />

      <CustomTextInput
        label="API Key"
        value={config.apiKey}
        onChangeText={value => onUpdate(config.id, 'apiKey', value.trim())}
        placeholder="Enter API Key"
        secureTextEntry={true}
      />

      <CustomTextInput
        label="Model ID"
        value={config.modelIds}
        onChangeText={value => onUpdate(config.id, 'modelIds', value.trim())}
        placeholder="Enter Model IDs, split by comma"
        secureTextEntry={false}
        numberOfLines={4}
      />
    </View>
  );
}

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      marginBottom: 8,
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    headerLabel: {
      marginBottom: 0,
    },
    removeButton: {
      paddingVertical: 4,
    },
    removeIcon: {
      width: 24,
      height: 24,
    },
  });
