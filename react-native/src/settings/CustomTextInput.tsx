import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

interface CustomTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
}

const CustomTextInput: React.FC<CustomTextInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    marginTop: 8,
  },
  label: {
    position: 'absolute',
    backgroundColor: 'white',
    color: 'black',
    left: 8,
    top: -8,
    zIndex: 999,
    paddingHorizontal: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    height: 44,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    color: 'black',
  },
});

export default CustomTextInput;
