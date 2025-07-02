import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
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
  getCurrentVoiceSystemPrompt,
  getSystemPrompts,
  getTextModel,
  isTokenValid,
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
import Dialog from 'react-native-dialog';
import { requestToken } from '../../api/bedrock-api.ts';
import { useTheme, ColorScheme } from '../../theme';

interface PromptListProps {
  onSelectPrompt: (prompt: SystemPrompt | null) => void;
  onSwitchedToTextModel: () => void;
}

type NavigationProp = DrawerNavigationProp<RouteParamList>;
export const PromptListComponent: React.FC<PromptListProps> = ({
  onSelectPrompt,
  onSwitchedToTextModel,
}) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<NavigationProp>();
  const [isNovaSonic, setIsNovaSonic] = useState(
    getTextModel().modelId.includes('nova-sonic')
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(
    isNovaSonic ? getCurrentVoiceSystemPrompt : getCurrentSystemPrompt
  );
  const [prompts, setPrompts] = useState<SystemPrompt[]>(
    getSystemPrompts(isNovaSonic ? 'voice' : undefined)
  );
  const rawListRef = useRef<FlatList<SystemPrompt>>(null);
  const { event, sendEvent } = useAppContext();
  const sendEventRef = useRef(sendEvent);
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const deletePromptIdRef = useRef<number>(0);

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
    if (!event) {
      return;
    }

    if (event.event === 'modelChanged') {
      const newIsNovaSonic = getTextModel().modelId.includes('nova-sonic');
      if (isNovaSonic && !newIsNovaSonic) {
        onSwitchedToTextModel();
      }
      setIsNovaSonic(newIsNovaSonic);
      const newPrompt = newIsNovaSonic
        ? getCurrentVoiceSystemPrompt()
        : getCurrentSystemPrompt();
      setSelectedPrompt(newPrompt);
      onSelectPrompt(newPrompt);
      setPrompts(getSystemPrompts(newIsNovaSonic ? 'voice' : undefined));
      sendEventRef.current('');
      if (newIsNovaSonic) {
        if (!isTokenValid()) {
          requestToken().then();
        }
      }
    } else if (event.params?.prompt) {
      const newPrompt = event.params.prompt;
      const promptType = isNovaSonic ? 'voice' : undefined;
      if (event.event === 'onPromptUpdate') {
        const newPrompts = prompts.map(prompt =>
          prompt.id === newPrompt.id ? newPrompt : prompt
        );
        setPrompts(newPrompts);
        saveSystemPrompts(newPrompts, promptType);
        if (selectedPrompt?.id === newPrompt.id) {
          onSelectPrompt(newPrompt);
        }
      } else if (event.event === 'onPromptAdd') {
        const newPrompts = [...prompts, newPrompt];
        setPrompts(newPrompts);
        saveSystemPrompts(newPrompts, promptType);
        savePromptId(newPrompt.id);
        scrollToEnd();
      }
      sendEventRef.current('');
    }
  }, [
    event,
    prompts,
    isNovaSonic,
    onSelectPrompt,
    selectedPrompt?.id,
    onSwitchedToTextModel,
  ]);

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

  const handleDelete = () => {
    const newPrompts = prompts.filter(
      prompt => prompt.id !== deletePromptIdRef.current
    );
    if (selectedPrompt?.id === deletePromptIdRef.current) {
      onSelectPrompt(null);
    }
    setPrompts(newPrompts);
    saveSystemPrompts(newPrompts, isNovaSonic ? 'voice' : undefined);
    deletePromptIdRef.current = 0;
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
              prompts[0] === item && styles.firstButton,
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
                setShowDialog(true);
                deletePromptIdRef.current = item.id;
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
        ref={rawListRef as never}
        data={prompts}
        horizontal
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        alwaysBounceHorizontal={true}
        keyExtractor={item => item.id.toString()}
        onDragEnd={({ data }) => {
          setPrompts(data);
          saveSystemPrompts(data, isNovaSonic ? 'voice' : undefined);
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
            source={
              isDark
                ? require('../../assets/done_dark.png')
                : require('../../assets/done.png')
            }
            style={styles.doneImage}
          />
        </TouchableOpacity>
      )}
      <Dialog.Container visible={showDialog}>
        <Dialog.Title>Delete Prompt</Dialog.Title>
        <Dialog.Description>You cannot undo this action.</Dialog.Description>
        <Dialog.Button
          label="Cancel"
          onPress={() => {
            setShowDialog(false);
          }}
        />
        <Dialog.Button
          label="Delete"
          onPress={() => {
            handleDelete();
            setShowDialog(false);
          }}
        />
      </Dialog.Container>
    </View>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
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
      backgroundColor: colors.promptButtonBackground,
      borderRadius: 8,
      marginLeft: 8,
      borderWidth: 1.3,
      borderColor: colors.promptButtonBorder,
    },
    firstButton: {
      marginLeft: 10,
    },
    lastButton: {
      marginRight: 10,
    },
    selectedPromptButton: {
      backgroundColor: colors.promptButtonBackground,
      borderColor: colors.promptSelectedBorder,
    },
    promptText: {
      fontSize: 14,
      marginTop: Platform.OS === 'android' ? -2 : 0,
      color: colors.promptText,
    },
    selectedPromptText: {
      color: colors.text,
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: 20,
      marginTop: 17,
      marginLeft: 8,
      backgroundColor: colors.promptAddButtonBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.3,
      borderColor: colors.promptAddButtonBorder,
    },
    addText: {
      fontSize: 20,
      color: colors.promptAddText,
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
      backgroundColor: colors.promptDeleteBackground,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: {
      color: colors.promptDeleteText,
      fontSize: 12,
      marginTop: -1.8,
      marginRight: -0.5,
      fontWeight: 'normal',
    },
    draggingPrompt: {
      opacity: 0.9,
    },
  });
