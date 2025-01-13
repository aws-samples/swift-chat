import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteParamList } from '../types/RouteTypes.ts';
import { SystemPrompt } from '../types/Chat.ts';
import { showInfo } from '../chat/util/ToastUtils.ts';
import { useAppContext } from '../history/AppProvider.tsx';
import { getPromptId } from '../storage/StorageUtils.ts';
import { HeaderLeftView } from './HeaderLeftView.tsx';
import { isMac } from '../App.tsx';

type NavigationProp = DrawerNavigationProp<RouteParamList>;
type PromptScreenRouteProp = RouteProp<RouteParamList, 'Prompt'>;
const MAX_NAME_LENGTH = 20;

function PromptScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PromptScreenRouteProp>();
  const isAddMode = route.params.prompt === undefined;
  const [currentPrompt, setCurrentPrompt] = useState<SystemPrompt>(
    isAddMode
      ? {
          id: getPromptId() + 1,
          name: '',
          prompt: '',
          includeHistory: false,
        }
      : route.params.prompt
  );
  const { sendEvent } = useAppContext();

  const headerLeft = useCallback(
    () => HeaderLeftView(navigation),
    [navigation]
  );
  React.useLayoutEffect(() => {
    const headerOption = {
      headerLeft,
    };
    navigation.setOptions(headerOption);
  }, [navigation, headerLeft]);

  const handleSave = () => {
    if (currentPrompt.name.trim().length === 0) {
      showInfo('Please enter prompt name');
      return;
    }
    if (calculateTextLength(currentPrompt.name) > MAX_NAME_LENGTH) {
      showInfo(`Please keep your text under ${MAX_NAME_LENGTH} characters`);
      return;
    }
    if (currentPrompt.prompt.trim().length === 0) {
      showInfo('Please enter system prompt');
      return;
    }

    sendEvent(isAddMode ? 'onPromptAdd' : 'onPromptUpdate', {
      prompt: currentPrompt,
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        automaticallyAdjustKeyboardInsets={true}>
        <TextInput
          style={[styles.input, isMac && styles.macInput]}
          placeholder="Prompt name"
          value={currentPrompt.name}
          onChangeText={text => {
            setCurrentPrompt({ ...currentPrompt, name: text });
          }}
        />
        <TextInput
          style={[styles.input, styles.contentInput, isMac && styles.macInput]}
          placeholder="Systrem prompt"
          value={currentPrompt.prompt}
          multiline
          onChangeText={text => {
            setCurrentPrompt({ ...currentPrompt, prompt: text });
          }}
        />
        <View style={styles.switchContainer}>
          <Text style={styles.label}>Include Chat History</Text>
          <Switch
            style={[isMac ? styles.switch : {}]}
            value={currentPrompt.includeHistory}
            onValueChange={value => {
              setCurrentPrompt({ ...currentPrompt, includeHistory: value });
            }}
          />
        </View>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>
            {isAddMode ? 'Create' : 'Update'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function calculateTextLength(str: string) {
  const chineseRegex = /[\u4e00-\u9fa5]/g;
  const chineseCount = (str.match(chineseRegex) || []).length;
  const nonChineseCount = str.length - chineseCount;
  return chineseCount * 2 + nonChineseCount;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  contentInput: {
    minHeight: 180,
    maxHeight: 560,
    textAlignVertical: 'top',
  },
  macInput: {
    fontWeight: '300',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  switch: {
    marginRight: -14,
    width: 32,
    height: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 36,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PromptScreen;
