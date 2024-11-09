import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';

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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Dropdown
        style={styles.dropdown}
        placeholderStyle={styles.placeholderStyle}
        selectedTextStyle={styles.selectedTextStyle}
        inputSearchStyle={styles.inputSearchStyle}
        data={data}
        search
        maxHeight={300}
        labelField="label"
        valueField="value"
        placeholder={placeholder}
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
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
    marginBottom: 8,
  },
  dropdown: {
    height: 40,
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
