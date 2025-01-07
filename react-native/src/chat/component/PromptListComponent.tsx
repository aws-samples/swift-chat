import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { useNavigation } from '@react-navigation/native';
import { SystemPrompt } from '../../types/Chat.ts';
import {
  getCurrentSystemPrompt,
  getSystemPrompts,
  saveSystemPrompts,
} from '../../storage/StorageUtils.ts';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from '@bwjohns4/react-native-draggable-flatlist';

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

  const renderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<SystemPrompt>) => {
    return (
      <ScaleDecorator>
        <View style={styles.promptContainer}>
          <Pressable
            onLongPress={isEditMode ? drag : handleLongPress}
            onPress={() => handlePromptSelect(item)}
            style={[
              styles.promptButton,
              selectedPrompt?.name === item.name && styles.selectedPromptButton,
              isActive && styles.draggingPrompt,
            ]}>
            <Text
              style={[
                styles.promptText,
                selectedPrompt?.name === item.name && styles.selectedPromptText,
              ]}>
              {item.name}
            </Text>
          </Pressable>
          {isEditMode && prompts.length > 1 && (
            <TouchableOpacity
              style={styles.deleteTouchable}
              onPress={() => {
                const newPrompts = prompts.filter(p => p.name !== item.name);
                if (selectedPrompt?.name === item.name) {
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
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.container}>
      <DraggableFlatList
        data={prompts}
        horizontal
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        alwaysBounceHorizontal={true}
        keyExtractor={item => item.name}
        onDragEnd={({ data }) => {
          setPrompts(data);
          saveSystemPrompts(data);
        }}
        containerStyle={styles.scrollContent}
        showsHorizontalScrollIndicator={false}
        ListFooterComponent={
          isEditMode ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddPrompt}>
              <Text style={styles.addText}>+</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      {isEditMode && (
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => setIsEditMode(false)}>
          <Image
            source={require('../../assets/done.png')}
            style={styles.doneImage}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  promptButton: {
    height: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    marginLeft: 8,
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
    marginTop: 17,
    marginLeft: 8,
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  doneImage: {
    width: 20,
    height: 20,
  },
  promptContainer: {
    alignSelf: 'center',
    marginTop: 6,
  },
  deleteTouchable: {
    position: 'absolute',
    right: -8,
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
  draggingPrompt: {
    opacity: 0.9,
  },
});
