import * as React from 'react';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Linking,
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
import {
  getTotalCost,
  getTotalImageCount,
  getTotalImagePrice,
  getTotalInputPrice,
  getTotalInputTokens,
  getTotalOutputPrice,
  getTotalOutputTokens,
  getUsagePrice,
} from './ModelPrice.ts';

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
      style={[
        styles.animatedContainer,
        {
          transform: [
            {
              translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [300, 0],
              }),
            },
          ],
        },
      ]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          {modelUsage
            .sort(
              (a, b) =>
                getUsagePrice(b).totalPrice - getUsagePrice(a).totalPrice
            )
            .map((usage, index) => {
              const usagePrice = getUsagePrice(usage);
              const isImageModel =
                usage.imageCount ||
                usage.smallImageCount ||
                usage.largeImageCount;

              return (
                <View key={index} style={styles.usageItem}>
                  <View style={styles.modelHeader}>
                    <Text style={styles.modelName}>{usage.modelName}</Text>
                    <Text style={styles.totalPrice}>
                      USD{' '}
                      {usagePrice.totalPrice === 0
                        ? '0.00'
                        : usagePrice.totalPrice}
                    </Text>
                  </View>

                  {isImageModel ? (
                    <>
                      {usage.smallImageCount ? (
                        <View style={styles.tokenInfo}>
                          <Text style={styles.tokenText}>
                            512-Standard:{' '}
                            {usage.smallImageCount.toLocaleString()}
                          </Text>
                          <Text style={styles.tokenText}>
                            USD {usagePrice.smallImagePrice}
                          </Text>
                        </View>
                      ) : null}
                      {usage.imageCount ? (
                        <View style={styles.tokenInfo}>
                          <Text style={styles.tokenText}>
                            1024-Standard: {usage.imageCount.toLocaleString()}
                          </Text>
                          <Text style={styles.tokenText}>
                            USD {usagePrice.mediumImagePrice}
                          </Text>
                        </View>
                      ) : null}
                      {usage.largeImageCount ? (
                        <View style={styles.tokenInfo}>
                          <Text style={styles.tokenText}>
                            2048-Standard:{' '}
                            {usage.largeImageCount.toLocaleString()}
                          </Text>
                          <Text style={styles.tokenText}>
                            USD {usagePrice.largeImagePrice}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <View style={styles.tokenInfo}>
                        <Text style={styles.tokenText}>
                          Input: {usage.inputTokens.toLocaleString()}
                        </Text>
                        <Text style={styles.tokenText}>
                          USD {usagePrice.inputPrice}
                        </Text>
                      </View>
                      <View style={styles.tokenInfo}>
                        <Text style={styles.tokenText}>
                          Output: {usage.outputTokens.toLocaleString()}
                        </Text>
                        <Text style={styles.tokenText}>
                          USD {usagePrice.outputPrice}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          <View style={styles.totalContainer}>
            <View style={styles.totalHeader}>
              <Text style={styles.totalLabel}>Total Usage</Text>
              <Text style={styles.totalPrice}>
                USD {getTotalCost(modelUsage).toString()}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalText}>
                Input Tokens: {getTotalInputTokens(modelUsage).toLocaleString()}
              </Text>
              <Text style={styles.totalText}>
                USD {getTotalInputPrice(modelUsage).toString()}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalText}>
                Output Tokens:{' '}
                {getTotalOutputTokens(modelUsage).toLocaleString()}
              </Text>
              <Text style={styles.totalText}>
                USD {getTotalOutputPrice(modelUsage).toString()}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalText}>
                Images: {getTotalImageCount(modelUsage).toLocaleString()}
              </Text>
              <Text style={styles.totalText}>
                USD {getTotalImagePrice(modelUsage).toString()}
              </Text>
            </View>
          </View>
          <Text
            style={styles.priceLink}
            onPress={() =>
              Linking.openURL('https://aws.amazon.com/bedrock/pricing/')
            }>
            * Estimated costs based on US region pricing. Actual charges may
            vary by region. For accurate pricing, please refer to{' '}
            <Text style={[styles.priceLink, styles.underline]}>
              Amazon Bedrock Pricing
            </Text>
          </Text>
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
  animatedContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 60,
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
  },
  tokenInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
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
  },
  totalText: {
    fontSize: 14,
    color: 'grey',
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pricingContainer: {
    marginTop: 16,
  },
  priceLink: {
    marginTop: 16,
    fontSize: 12,
    color: 'grey',
    paddingVertical: 8,
    textAlign: 'left',
  },
  underline: {
    textDecorationLine: 'underline',
  },
});

export default TokenUsageScreen;
