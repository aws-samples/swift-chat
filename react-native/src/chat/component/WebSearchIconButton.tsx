import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { getSearchProvider } from '../../storage/StorageUtils';
import { getSearchProviderIcon } from '../../utils/SearchIconUtils';
import { useTheme } from '../../theme';

interface WebSearchIconButtonProps {
  onPress: () => void;
}

export const WebSearchIconButton: React.FC<WebSearchIconButtonProps> = ({
  onPress,
}) => {
  const { isDark } = useTheme();
  const searchProvider = getSearchProvider();
  const searchIcon = getSearchProviderIcon(searchProvider as any, isDark);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Image source={searchIcon} style={styles.icon} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 42,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 14,
    marginBottom: -6,
  },
});
