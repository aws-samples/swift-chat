import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme, ColorScheme } from '../theme';

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
  const { colors } = useTheme();
  const styles = createStyles(colors);
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

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    tab: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 6,
    },
    selectedTab: {
      backgroundColor: colors.background,
      shadowColor: colors.shadow,
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
      color: colors.textSecondary,
      fontWeight: '500',
    },
    selectedTabText: {
      color: colors.text,
    },
  });

export default TabButton;
