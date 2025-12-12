import React, { useCallback, useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Image,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteParamList } from '../types/RouteTypes';
import { getSavedApps, deleteApp, getAppById, AppMetadata } from '../storage/StorageUtils';
import { HeaderLeftView } from '../prompt/HeaderLeftView';
import { useTheme, ColorScheme } from '../theme';
import RNFS from 'react-native-fs';

type NavigationProp = DrawerNavigationProp<RouteParamList>;

const getNumColumns = (width: number) => (width > 434 ? 3 : 2);

function AppGalleryScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();
  const [apps, setApps] = useState<AppMetadata[]>([]);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const numColumns = getNumColumns(screenWidth);
  const styles = createStyles(colors, numColumns);

  // Listen for screen size changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const loadApps = useCallback(() => {
    const savedApps = getSavedApps();
    setApps(savedApps);
  }, []);

  // Reload apps when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadApps();
    }, [loadApps])
  );

  const headerLeft = useCallback(
    () => HeaderLeftView(navigation, isDark),
    [navigation, isDark]
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft,
      title: 'App Gallery',
    });
  }, [navigation, headerLeft]);

  const handleDeleteApp = useCallback(
    (app: AppMetadata) => {
      Alert.alert('Delete App', `Are you sure you want to delete "${app.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Delete screenshot file if exists
            if (app.screenshotPath) {
              try {
                const exists = await RNFS.exists(app.screenshotPath);
                if (exists) {
                  await RNFS.unlink(app.screenshotPath);
                }
              } catch (error) {
                console.log('Error deleting screenshot:', error);
              }
            }
            deleteApp(app.id);
            loadApps();
          },
        },
      ]);
    },
    [loadApps]
  );

  const handleOpenApp = useCallback(
    (appMetadata: AppMetadata) => {
      const app = getAppById(appMetadata.id);
      if (app) {
        navigation.navigate('AppViewer', { app });
      }
    },
    [navigation]
  );

  const renderAppItem = useCallback(
    ({ item }: { item: AppMetadata }) => {
      const screenshotUri = item.screenshotPath
        ? Platform.OS === 'ios'
          ? item.screenshotPath
          : 'file://' + item.screenshotPath
        : null;

      return (
        <TouchableOpacity
          style={styles.appCard}
          onPress={() => handleOpenApp(item)}
          onLongPress={() => handleDeleteApp(item)}
          activeOpacity={0.7}>
          <View style={styles.screenshotContainer}>
            {screenshotUri ? (
              <Image
                source={{ uri: screenshotUri }}
                style={styles.screenshot}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={styles.placeholderText}>No Preview</Text>
              </View>
            )}
          </View>
          <View style={styles.appInfo}>
            <Text style={styles.appName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.appDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [styles, handleOpenApp, handleDeleteApp]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No saved apps yet</Text>
        <Text style={styles.emptySubtext}>
          Generate HTML apps in chat and save them here
        </Text>
      </View>
    ),
    [styles]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        key={`flatlist-${numColumns}`}
        data={apps}
        renderItem={renderAppItem}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={apps.length > 1 ? styles.columnWrapper : undefined}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorScheme, numColumns: number) => {
  // Calculate card width based on number of columns
  // 12px padding on each side, 8px gap between cards
  const cardWidthPercent = numColumns === 3 ? '31.5%' : '48%';

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContainer: {
      padding: 12,
      flexGrow: 1,
    },
    columnWrapper: {
      justifyContent: 'space-between',
    },
    appCard: {
      width: cardWidthPercent,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    screenshotContainer: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: colors.input,
    },
    screenshot: {
      width: '100%',
      height: '100%',
    },
    placeholderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    appInfo: {
      padding: 10,
    },
    appName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    appDate: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
};

export default AppGalleryScreen;
