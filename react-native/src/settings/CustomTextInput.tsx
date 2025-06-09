import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';

interface CustomTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  numberOfLines?: number;
}

const CustomTextInput: React.FC<CustomTextInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  numberOfLines = 1,
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={{
            ...styles.input,
            ...(secureTextEntry && styles.inputPadding),
            ...(numberOfLines > 1 && { lineHeight: 22 }),
          }}
          value={value}
          numberOfLines={Platform.OS === 'ios' ? numberOfLines : undefined}
          multiline={numberOfLines > 1}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={togglePasswordVisibility}>
            <Image
              source={
                isPasswordVisible
                  ? require('../assets/eye_close.png')
                  : require('../assets/eye.png')
              }
              style={styles.eyeIcon}
            />
          </TouchableOpacity>
        )}
      </View>
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    minHeight: 44,
    maxHeight: 160,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
    color: 'black',
    flex: 1,
  },
  inputPadding: {
    paddingRight: 40,
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  eyeIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
});

export default CustomTextInput;
