import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { setHapticFeedbackEnabled, trigger } from '../chat/util/HapticUtils.ts';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src';
import {
  getAllImageSize,
  getAllModels,
  getAllRegions,
  getApiKey,
  getApiUrl,
  getHapticEnabled,
  getImageModel,
  getImageSize,
  getModelUsage,
  getRegion,
  getTextModel,
  isNewStabilityImageModel,
  saveAllModels,
  saveImageModel,
  saveImageSize,
  saveKeys,
  saveRegion,
  saveTextModel,
} from '../storage/StorageUtils.ts';
import { CustomHeaderRightButton } from '../chat/component/CustomHeaderRightButton.tsx';
import { RouteParamList } from '../types/RouteTypes.ts';
import { requestAllModels, requestUpgradeInfo } from '../api/bedrock-api.ts';
import { DropdownItem, Model, UpgradeInfo } from '../types/Chat.ts';

import packageJson from '../../package.json';
import { isMac } from '../App.tsx';
import CustomDropdown from './DropdownComponent.tsx';
import Toast from 'react-native-toast-message';
import { getTotalCost } from './ModelPrice.ts';

const initUpgradeInfo: UpgradeInfo = {
  needUpgrade: false,
  version: '',
  url: '',
};

const GITHUB_LINK = 'https://github.com/aws-samples/swift-chat';

function SettingsScreen(): React.JSX.Element {
  const [apiUrl, setApiUrl] = useState(getApiUrl);
  const [apiKey, setApiKey] = useState(getApiKey);
  const [region, setRegion] = useState(getRegion);
  const [imageSize, setImageSize] = useState(getImageSize);
  const [hapticEnabled, setHapticEnabled] = useState(getHapticEnabled);
  const navigation = useNavigation<NavigationProp<RouteParamList>>();
  const [textModels, setTextModels] = useState<Model[]>([]);
  const [selectedTextModel, setSelectedTextModel] = useState<string>('');
  const [imageModels, setImageModels] = useState<Model[]>([]);
  const [selectedImageModel, setSelectedImageModel] = useState<string>('');
  const [upgradeInfo, setUpgradeInfo] = useState<UpgradeInfo>(initUpgradeInfo);
  const [cost, setCost] = useState('0.00');

  useEffect(() => {
    return navigation.addListener('focus', () => {
      setCost(getTotalCost(getModelUsage()).toString());
      fetchAndSetModelNames().then();
    });
  }, [navigation]);

  const toggleHapticFeedback = (value: boolean) => {
    setHapticEnabled(value);
    setHapticFeedbackEnabled(value);
    if (value && Platform.OS === 'android') {
      trigger(HapticFeedbackTypes.impactMedium);
    }
  };

  const handleCheckUpgrade = async () => {
    if ((isMac || Platform.OS === 'android') && upgradeInfo.needUpgrade) {
      await Linking.openURL(upgradeInfo.url);
    } else {
      await Linking.openURL(GITHUB_LINK + '/releases');
    }
  };

  useEffect(() => {
    const allModel = getAllModels();
    const textModel = getTextModel();
    setTextModels(allModel.textModel);
    setSelectedTextModel(textModel.modelId);
    const imageModel = getImageModel();
    setImageModels(allModel.imageModel);
    setSelectedImageModel(imageModel.modelId);
    if (apiUrl.length > 0 && apiKey.length > 0) {
      saveKeys(apiUrl, apiKey);
      fetchAndSetModelNames().then();
      fetchUpgradeInfo().then();
    }
  }, [apiUrl, apiKey]);

  const fetchAndSetModelNames = async () => {
    const response = await requestAllModels();
    if (response.imageModel.length > 0) {
      setImageModels(response.imageModel);
    }
    if (response.textModel.length > 0) {
      setTextModels(response.textModel);
    }
    if (response.imageModel.length > 0 || response.textModel.length > 0) {
      saveAllModels(response);
    }
  };

  const fetchUpgradeInfo = async () => {
    if (isMac || Platform.OS === 'android') {
      const os = isMac ? 'mac' : 'android';
      const version = packageJson.version;
      const response = await requestUpgradeInfo(os, version);
      if (response.needUpgrade) {
        setUpgradeInfo(response);
      }
    }
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => (
        <CustomHeaderRightButton
          onPress={async () => {
            if (apiUrl.length > 0 && apiKey.length > 0) {
              navigation.navigate('Bedrock', {
                sessionId: -1,
                tapIndex: -1,
              });
            } else {
              Toast.show({
                type: 'info',
                text1: 'Please input your API URL and API Key',
              });
            }
          }}
          imageSource={require('../assets/done.png')}
        />
      ),
    });
  }, [apiUrl, apiKey, region, navigation]);

  const regionsData: DropdownItem[] = getAllRegions().map(regionId => ({
    label: regionId ?? '',
    value: regionId ?? '',
  }));
  const textModelsData: DropdownItem[] = textModels.map(model => ({
    label: model.modelName ?? '',
    value: model.modelId ?? '',
  }));
  const imageModelsData: DropdownItem[] = imageModels.map(model => ({
    label: model.modelName ?? '',
    value: model.modelId ?? '',
  }));
  const imageSizesData: DropdownItem[] = getAllImageSize(
    selectedImageModel
  ).map(size => ({
    label: size,
    value: size,
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <Text style={styles.label}>API URL</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="Enter API URL"
        />
        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="Enter API Key"
          secureTextEntry={true}
        />
        <CustomDropdown
          label="Select Region"
          data={regionsData}
          value={region}
          onChange={(item: DropdownItem) => {
            if (item.value !== '' && item.value !== region) {
              setRegion(item.value);
              saveRegion(item.value);
              fetchAndSetModelNames().then();
            }
          }}
          placeholder="Select a region"
        />
        <CustomDropdown
          label="Select Text Model"
          data={textModelsData}
          value={selectedTextModel}
          onChange={(item: DropdownItem) => {
            if (item.value !== '') {
              setSelectedTextModel(item.value);
              const selectedModel = textModels.find(
                model => model.modelId === item.value
              );
              if (selectedModel) {
                saveTextModel(selectedModel);
              }
            }
          }}
          placeholder="Select a model"
        />
        <CustomDropdown
          label="Select Image Model"
          data={imageModelsData}
          value={selectedImageModel}
          onChange={(item: DropdownItem) => {
            if (item.value !== '') {
              setSelectedImageModel(item.value);
              const selectedModel = imageModels.find(
                model => model.modelId === item.value
              );
              if (selectedModel) {
                saveImageModel(selectedModel);
                if (isNewStabilityImageModel(item.value)) {
                  setImageSize('1024 x 1024');
                  saveImageSize('1024 x 1024');
                }
              }
            }
          }}
          placeholder="Select a model"
        />
        <CustomDropdown
          label="Select Image Size"
          data={imageSizesData}
          value={imageSize}
          onChange={(item: DropdownItem) => {
            if (item.value !== '') {
              setImageSize(item.value);
              saveImageSize(item.value);
            }
          }}
          placeholder="Select image size"
        />
        <TouchableOpacity
          activeOpacity={1}
          style={styles.itemContainer}
          onPress={() => navigation.navigate('TokenUsage', {})}>
          <Text style={styles.label}>Usage</Text>
          <View style={styles.arrowContainer}>
            <Text style={styles.text}>{`USD ${cost}`}</Text>
            <Image
              style={styles.arrowImage}
              source={require('../assets/back.png')}
            />
          </View>
        </TouchableOpacity>
        {!isMac && (
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Haptic Feedback</Text>
            <Switch
              value={hapticEnabled}
              onValueChange={toggleHapticFeedback}
            />
          </View>
        )}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.itemContainer}
          onPress={() => Linking.openURL(GITHUB_LINK)}>
          <Text style={styles.label}>Configuration Guide</Text>
          <Image
            style={styles.arrowImage}
            source={require('../assets/back.png')}
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.itemContainer}
          onPress={() =>
            Linking.openURL(GITHUB_LINK + '/discussions/new?category=general')
          }>
          <Text style={styles.label}>Submit Feedback</Text>
          <Image
            style={styles.arrowImage}
            source={require('../assets/back.png')}
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.itemContainer}
          onPress={() =>
            Linking.openURL(
              GITHUB_LINK + '/issues/new?template=bug_report.yaml'
            )
          }>
          <Text style={styles.label}>Report an Issue</Text>
          <Image
            style={styles.arrowImage}
            source={require('../assets/back.png')}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.versionContainer}
          activeOpacity={1}
          onPress={handleCheckUpgrade}>
          <Text style={styles.label}>App Version</Text>
          <View style={styles.arrowContainer}>
            <Text style={styles.text}>
              {packageJson.version +
                (upgradeInfo.needUpgrade
                  ? ' (' + upgradeInfo.version + ')'
                  : '')}
            </Text>
            <Image
              style={styles.arrowImage}
              source={require('../assets/back.png')}
            />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
  },
  text: {
    fontSize: 14,
    fontWeight: '400',
    color: 'grey',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 16,
    marginTop: 8,
    paddingHorizontal: 10,
    color: 'black',
  },
  regionAutoSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  arrowContainer: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  arrowImage: {
    width: 16,
    height: 16,
    transform: [{ scaleX: -1 }],
    opacity: 0.4,
    marginLeft: 4,
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
    paddingBottom: 60,
  },
});

export default SettingsScreen;
