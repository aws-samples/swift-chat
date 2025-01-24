import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

interface TabButtonProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function TabButton({
  label,
  isSelected,
  onPress,
}: TabButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.tab, isSelected && styles.selectedTab]}
      onPress={onPress}>
      <Text style={[styles.tabText, isSelected && styles.selectedTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  selectedTab: {
    backgroundColor: 'white',
    shadowColor: 'black',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedTabText: {
    color: 'black',
  },
});

export default TabButton;
