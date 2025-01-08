import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteParamList } from '../types/RouteTypes.ts';
// @ts-ignore
import { HeaderOptions } from '@react-navigation/elements/src/types.tsx';

type NavigationProp = DrawerNavigationProp<RouteParamList>;

function PromptScreen(): React.JSX.Element {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const navigation = useNavigation<NavigationProp>();

  React.useLayoutEffect(() => {
    const headerOption: HeaderOptions = {
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerContainer}>
          <Image
            source={require('../assets/back.png')}
            style={styles.headerImage}
          />
        </TouchableOpacity>
      ),
    };
    navigation.setOptions(headerOption);
  }, [navigation]);

  const handleSave = () => {
    const newPrompt = {
      id: Date.now().toString(),
      name,
      content,
    };
    // route.params.onAdd(newPrompt);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Prompt name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={[styles.input, styles.contentInput]}
        placeholder="Systrem prompt"
        value={content}
        onChangeText={setContent}
        multiline
      />
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Create</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    marginLeft: -10,
    paddingRight: 16,
    padding: 10,
  },
  headerImage: { width: 20, height: 20 },
  container: {
    flex: 1,
    padding: 16,
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
    height: 150,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default PromptScreen;
