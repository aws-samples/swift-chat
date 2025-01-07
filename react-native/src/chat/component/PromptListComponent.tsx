import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Text,
  Pressable,
  Image,
} from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { useNavigation } from '@react-navigation/native';
import { SystemPrompt } from '../../types/Chat.ts';
import {
  getCurrentSystemPrompt,
  getSystemPrompts,
  saveSystemPrompts,
} from '../../storage/StorageUtils.ts';

const storage = new MMKV();
const STORAGE_KEY = 'system_prompts';

interface PromptListProps {
  onSelectPrompt: (prompt: SystemPrompt | null) => void;
}

export const PromptListComponent: React.FC<PromptListProps> = ({
  onSelectPrompt,
}) => {
  const navigation = useNavigation();
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(
    getCurrentSystemPrompt
  );
  const [prompts, setPrompts] = useState<SystemPrompt[]>(getSystemPrompts);

  const handleLongPress = () => {
    setIsEditMode(true);
  };

  const handlePromptSelect = (prompt: SystemPrompt) => {
    if (isEditMode) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      navigation.navigate('EditPrompt', {
        prompt,
        onUpdate: (updatedPrompt: SystemPrompt) => {
          const newPrompts = prompts.map(p =>
            p.name === updatedPrompt.name ? updatedPrompt : p
          );
          setPrompts(newPrompts);
          storage.set(STORAGE_KEY, JSON.stringify(newPrompts));
        },
        onDelete: (promptName: string) => {
          const newPrompts = prompts.filter(p => p.name !== promptName);
          setPrompts(newPrompts);
          storage.set(STORAGE_KEY, JSON.stringify(newPrompts));
        },
      });
    } else {
      const newPrompt = selectedPrompt?.name === prompt.name ? null : prompt;
      setSelectedPrompt(newPrompt);
      onSelectPrompt(newPrompt);
    }
  };

  const handleAddPrompt = () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    navigation.navigate('AddPrompt', {
      onAdd: (newPrompt: SystemPrompt) => {
        const newPrompts = [...prompts, newPrompt];
        setPrompts(newPrompts);
        storage.set(STORAGE_KEY, JSON.stringify(newPrompts));
      },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.scrollContent}>
        {prompts.map(prompt => (
          <View key={prompt.name} style={styles.promptContainer}>
            <Pressable
              key={prompt.name}
              onPress={() => handlePromptSelect(prompt)}
              onLongPress={handleLongPress}
              style={[
                styles.promptButton,
                selectedPrompt?.name === prompt.name &&
                  styles.selectedPromptButton,
              ]}>
              <Text
                style={[
                  styles.promptText,
                  selectedPrompt?.name === prompt.name &&
                    styles.selectedPromptText,
                ]}>
                {prompt.name}
              </Text>
            </Pressable>
            {isEditMode && prompts.length > 1 && (
              <TouchableOpacity
                style={styles.deleteTouchable}
                onPress={() => {
                  const newPrompts = prompts.filter(
                    p => p.name !== prompt.name
                  );
                  if (selectedPrompt?.name === prompt.name) {
                    onSelectPrompt(null);
                  }
                  setPrompts(newPrompts);
                  saveSystemPrompts(newPrompts);
                }}>
                <View style={styles.deleteLayout}>
                  <Text style={styles.deleteText}>×</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {isEditMode && (
          <TouchableOpacity style={styles.addButton} onPress={handleAddPrompt}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {isEditMode && (
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => setIsEditMode(false)}>
          <Image
            source={require('../../assets/done.png')}
            style={styles.doneImage}></Image>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  promptButton: {
    height: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1.2,
    borderColor: '#E8E8E8',
  },
  selectedPromptButton: {
    backgroundColor: '#E8E8E8',
    borderColor: 'black',
  },
  promptText: {
    fontSize: 14,
    color: '#333',
  },
  selectedPromptText: {
    color: 'black',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 20,
    marginTop: 7,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#666',
  },
  addText: {
    fontSize: 20,
    color: '#666',
    marginTop: -1.5,
  },
  doneButton: {
    padding: 20,
    marginTop: 6,
  },
  doneImage: {
    width: 20,
    height: 20,
  },
  promptContainer: {
    position: 'relative',
    marginTop: 6,
  },
  deleteTouchable: {
    position: 'absolute',
    right: -0,
    top: -8,
    zIndex: 1,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLayout: {
    width: 16,
    height: 16,
    backgroundColor: '#666',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#fff',
    fontSize: 12,
    marginTop: -2,
    marginRight: -0.5,
    fontWeight: 'normal',
  },
});
