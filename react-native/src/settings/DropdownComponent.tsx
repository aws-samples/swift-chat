import React, { useState } from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { isMac } from '../App.tsx';

interface DropdownItem {
  label: string;
  value: string;
}

interface CustomDropdownProps {
  label: string;
  data: DropdownItem[];
  value: string | null;
  onChange: (item: DropdownItem) => void;
  placeholder: string;
  searchPlaceholder?: string;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  data,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Search...',
}) => {
  const renderItem = (item: DropdownItem) => {
    const isSelected = item.value === value;
    return (
      <View style={styles.item}>
        <Text style={styles.textItem}>{item.label}</Text>
        {isSelected && (
          <Image source={require('../assets/done.png')} style={styles.icon} />
        )}
      </View>
    );
  };
  const [isFocus, setIsFocus] = useState(false);
  const renderLabel = (labelText: string) => {
    if (value || isFocus) {
      return <Text style={[styles.label]}>{labelText}</Text>;
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {renderLabel(label)}
      <Dropdown
        style={styles.dropdown}
        placeholderStyle={styles.placeholderStyle}
        selectedTextStyle={styles.selectedTextStyle}
        inputSearchStyle={styles.inputSearchStyle}
        data={data}
        search
        maxHeight={isMac ? 600 : 420}
        labelField="label"
        valueField="value"
        placeholder={placeholder}
        onFocus={() => setIsFocus(true)}
        searchPlaceholder={searchPlaceholder}
        value={value}
        onChange={onChange}
        renderItem={renderItem}
      />
    </View>
  );
};

export default CustomDropdown;

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
  dropdown: {
    height: 44,
    backgroundColor: 'white',
    borderRadius: 6,
    borderColor: 'gray',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: 'black',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  placeholderStyle: {
    fontSize: 14,
    color: 'gray',
  },
  selectedTextStyle: {
    fontSize: 14,
    color: 'black',
  },
  inputSearchStyle: {
    height: 36,
    fontSize: 14,
    color: 'black',
    borderRadius: 4,
  },
  icon: {
    width: 20,
    height: 20,
  },
  item: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textItem: {
    flex: 1,
    fontSize: 14,
    color: 'black',
  },
});
