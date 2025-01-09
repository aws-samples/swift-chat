import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SystemPrompt } from '../../types/Chat.ts';
import {
  getCurrentSystemPrompt,
  getSystemPrompts,
  savePromptId,
  saveSystemPrompts,
} from '../../storage/StorageUtils.ts';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from '@bwjohns4/react-native-draggable-flatlist';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteParamList } from '../../types/RouteTypes.ts';
import { useAppContext } from '../../history/AppProvider.tsx';

interface PromptListProps {
  onSelectPrompt: (prompt: SystemPrompt | null) => void;
}

type NavigationProp = DrawerNavigationProp<RouteParamList>;
export const PromptListComponent: React.FC<PromptListProps> = ({
  onSelectPrompt,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(
    getCurrentSystemPrompt
  );
  const [prompts, setPrompts] = useState<SystemPrompt[]>(getSystemPrompts);
  const rawListRef = useRef<FlatList<SystemPrompt>>(null);
  const { event, sendEvent } = useAppContext();
  const sendEventRef = useRef(sendEvent);

  const handleLongPress = () => {
    setIsEditMode(true);
    scrollToEnd();
  };

  const scrollToEnd = () => {
    setTimeout(() => {
      rawListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    const newPrompt = event?.params?.prompt;
    if (newPrompt) {
      if (event?.event === 'onPromptUpdate') {
        const newPrompts = prompts.map(prompt =>
          prompt.id === newPrompt.id ? newPrompt : prompt
        );
        setPrompts(newPrompts);
        saveSystemPrompts(newPrompts);
      } else if (event?.event === 'onPromptAdd') {
        const newPrompts = [...prompts, newPrompt];
        setPrompts(newPrompts);
        saveSystemPrompts(newPrompts);
        savePromptId(newPrompt.id);
        scrollToEnd();
      }
      sendEventRef.current('');
    }
  }, [event, prompts]);

  const handlePromptSelect = (prompt: SystemPrompt) => {
    if (isEditMode) {
      navigation.navigate('Prompt', { prompt });
    } else {
      const newPrompt = selectedPrompt?.id === prompt.id ? null : prompt;
      setSelectedPrompt(newPrompt);
      onSelectPrompt(newPrompt);
    }
  };

  const handleAddPrompt = () => {
    navigation.navigate('Prompt', {});
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
              selectedPrompt?.id === item.id && styles.selectedPromptButton,
              isActive && styles.draggingPrompt,
              !isEditMode && prompts[0] === item && styles.firstButton,
              !isEditMode &&
                prompts[prompts.length - 1] === item &&
                styles.lastButton,
            ]}>
            <Text
              style={[
                styles.promptText,
                selectedPrompt?.id === item.id && styles.selectedPromptText,
              ]}>
              {item.name}
            </Text>
          </Pressable>
          {isEditMode && prompts.length > 1 && (
            <TouchableOpacity
              style={styles.deleteTouchable}
              onPress={() => {
                const newPrompts = prompts.filter(
                  prompt => prompt.id !== item.id
                );
                if (selectedPrompt?.id === item.id) {
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
      <DraggableFlatList<SystemPrompt>
        ref={ref => {
          if (ref) {
            (rawListRef.current as FlatList<SystemPrompt>) = ref;
          }
        }}
        data={prompts}
        horizontal
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        alwaysBounceHorizontal={true}
        keyExtractor={item => item.id.toString()}
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
  firstButton: {
    marginLeft: 10,
  },
  lastButton: {
    marginRight: 10,
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
