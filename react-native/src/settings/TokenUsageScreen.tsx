import * as React from 'react';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getModelUsage } from '../storage/StorageUtils';
import { Usage } from '../types/Chat.ts';
import { useNavigation } from '@react-navigation/native';
import { HeaderOptions } from '@react-navigation/elements/src/types.tsx';
import { RouteParamList } from '../types/RouteTypes.ts';
import { DrawerNavigationProp } from '@react-navigation/drawer';

type NavigationProp = DrawerNavigationProp<RouteParamList>;

function TokenUsageScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const [modelUsage, setModelUsage] = React.useState<Usage[]>([]);
  React.useLayoutEffect(() => {
    const headerOption: HeaderOptions = {
      // eslint-disable-next-line react/no-unstable-nested-components
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings', {})}
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

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return navigation.addListener('focus', () => {
      setModelUsage(getModelUsage());
      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  }, [navigation, slideAnim]);

  return (
    <Animated.View
      style={{
        flex: 1,
        transform: [
          {
            translateX: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [300, 0],
            }),
          },
        ],
      }}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container}>
          {modelUsage.map((usage, index) => (
            <View key={index} style={styles.usageItem}>
              <Text style={styles.modelName}>{usage.modelName}</Text>
              <View style={styles.tokenInfo}>
                <Text style={styles.tokenText}>
                  Input: {usage.inputTokens.toLocaleString()}
                </Text>
                <Text style={styles.tokenText}>
                  Output: {usage.outputTokens.toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total Usage</Text>
            <View style={styles.tokenInfo}>
              <Text style={styles.totalText}>
                Input:{' '}
                {modelUsage
                  .reduce((sum, model) => sum + model.inputTokens, 0)
                  .toLocaleString()}
              </Text>
              <Text style={styles.totalText}>
                Output:{' '}
                {modelUsage
                  .reduce((sum, model) => sum + model.outputTokens, 0)
                  .toLocaleString()}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    padding: 16,
  },
  headerImage: { width: 20, height: 20 },
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  usageItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 14,
  },
  tokenInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tokenText: {
    fontSize: 14,
    color: 'grey',
  },
  totalContainer: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 16,
  },
  totalText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'black',
  },
});

export default TokenUsageScreen;
