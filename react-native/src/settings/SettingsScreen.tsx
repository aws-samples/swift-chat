import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { setHapticFeedbackEnabled, trigger } from '../chat/util/HapticUtils.ts';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src';
import {
  getAllImageSize,
  getAllModels,
  getApiKey,
  getApiUrl,
  getDeepSeekApiKey,
  getHapticEnabled,
  getImageModel,
  getImageSize,
  getModelUsage,
  getOllamaApiUrl,
  getOpenAIApiKey,
  getOpenAIProxyEnabled,
  getRegion,
  getTextModel,
  getThinkingEnabled,
  isNewStabilityImageModel,
  saveAllModels,
  saveDeepSeekApiKey,
  saveImageModel,
  saveImageSize,
  saveKeys,
  saveOllamaApiURL,
  saveOpenAIApiKey,
  saveOpenAIProxyEnabled,
  saveRegion,
  saveTextModel,
  saveThinkingEnabled,
} from '../storage/StorageUtils.ts';
import { CustomHeaderRightButton } from '../chat/component/CustomHeaderRightButton.tsx';
import { RouteParamList } from '../types/RouteTypes.ts';
import { requestAllModels, requestUpgradeInfo } from '../api/bedrock-api.ts';
import { DropdownItem, Model, UpgradeInfo } from '../types/Chat.ts';

import packageJson from '../../package.json';
import { isMac } from '../App.tsx';
import CustomDropdown from './DropdownComponent.tsx';
import { getTotalCost } from './ModelPrice.ts';
import {
  BedrockThinkingModels,
  DeepSeekModels,
  getAllRegions,
  getDefaultTextModels,
  GPTModels,
} from '../storage/Constants.ts';
import { showInfo } from '../chat/util/ToastUtils.ts';
import CustomTextInput from './CustomTextInput.tsx';
import { requestAllOllamaModels } from '../api/ollama-api.ts';
import TabButton from './TabButton';

const initUpgradeInfo: UpgradeInfo = {
  needUpgrade: false,
  version: '',
  url: '',
};

export const GITHUB_LINK = 'https://github.com/aws-samples/swift-chat';

function SettingsScreen(): React.JSX.Element {
  const allModel = getAllModels();
  const [apiUrl, setApiUrl] = useState(getApiUrl);
  const [apiKey, setApiKey] = useState(getApiKey);
  const [ollamaApiUrl, setOllamaApiUrl] = useState(getOllamaApiUrl);
  const [deepSeekApiKey, setDeepSeekApiKey] = useState(getDeepSeekApiKey);
  const [openAIApiKey, setOpenAIApiKey] = useState(getOpenAIApiKey);
  const [openAIProxyEnabled, setOpenAIProxyEnabled] = useState(
    getOpenAIProxyEnabled
  );
  const [region, setRegion] = useState(getRegion);
  const [imageSize, setImageSize] = useState(getImageSize);
  const [hapticEnabled, setHapticEnabled] = useState(getHapticEnabled);
  const navigation = useNavigation<NavigationProp<RouteParamList>>();
  const [textModels, setTextModels] = useState<Model[]>(allModel.textModel);
  const [selectedTextModel, setSelectedTextModel] =
    useState<Model>(getTextModel);
  const [imageModels, setImageModels] = useState<Model[]>(allModel.imageModel);
  const [selectedImageModel, setSelectedImageModel] = useState<string>(
    getImageModel().modelId
  );
  const [upgradeInfo, setUpgradeInfo] = useState<UpgradeInfo>(initUpgradeInfo);
  const [cost, setCost] = useState('0.00');
  const controllerRef = useRef<AbortController | null>(null);
  const [selectedTab, setSelectedTab] = useState('bedrock');
  const [thinkingEnabled, setThinkingEnabled] = useState(getThinkingEnabled);

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
    if (apiUrl === getApiUrl() && apiKey === getApiKey()) {
      return;
    }
    if (apiUrl.length > 0 && apiKey.length > 0) {
      saveKeys(apiUrl, apiKey);
      fetchAndSetModelNames().then();
      fetchUpgradeInfo().then();
    }
  }, [apiUrl, apiKey]);

  useEffect(() => {
    if (ollamaApiUrl === getOllamaApiUrl()) {
      return;
    }
    saveOllamaApiURL(ollamaApiUrl);
    if (ollamaApiUrl.length > 0) {
      fetchAndSetModelNames().then();
    }
  }, [ollamaApiUrl]);

  useEffect(() => {
    saveDeepSeekApiKey(deepSeekApiKey);
  }, [deepSeekApiKey]);

  useEffect(() => {
    saveOpenAIApiKey(openAIApiKey);
  }, [openAIApiKey]);

  const fetchAndSetModelNames = async () => {
    controllerRef.current = new AbortController();
    const ollamaModels = await requestAllOllamaModels();
    const response = await requestAllModels();
    if (response.imageModel.length > 0) {
      setImageModels(response.imageModel);
      const imageModel = getImageModel();
      const targetModels = response.imageModel.filter(
        model => model.modelName === imageModel.modelName
      );
      if (targetModels && targetModels.length === 1) {
        setSelectedImageModel(targetModels[0].modelId);
        saveImageModel(targetModels[0]);
      } else {
        setSelectedImageModel(response.imageModel[0].modelId);
        saveImageModel(response.imageModel[0]);
      }
    }
    if (response.textModel.length === 0) {
      response.textModel = [...getDefaultTextModels(), ...ollamaModels];
    } else {
      response.textModel = [
        ...response.textModel,
        ...ollamaModels,
        ...DeepSeekModels,
        ...GPTModels,
      ];
    }
    setTextModels(response.textModel);
    const textModel = getTextModel();
    const targetModels = response.textModel.filter(
      model => model.modelName === textModel.modelName
    );
    if (targetModels && targetModels.length === 1) {
      setSelectedTextModel(targetModels[0]);
      saveTextModel(targetModels[0]);
    } else {
      const defaultMissMatchModel = response.textModel.filter(
        model => model.modelName === 'Claude 3 Sonnet'
      );
      if (defaultMissMatchModel && defaultMissMatchModel.length === 1) {
        setSelectedTextModel(defaultMissMatchModel[0]);
        saveTextModel(defaultMissMatchModel[0]);
      }
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
              showInfo('Please input your API URL and API Key');
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

  const toggleOpenAIProxy = (value: boolean) => {
    setOpenAIProxyEnabled(value);
    saveOpenAIProxyEnabled(value);
  };

  const toggleThinking = (value: boolean) => {
    setThinkingEnabled(value);
    saveThinkingEnabled(value);
  };

  const renderProviderSettings = () => {
    switch (selectedTab) {
      case 'bedrock':
        return (
          <>
            <CustomTextInput
              label="API URL"
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="Enter API URL"
            />
            <CustomTextInput
              label="API Key"
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Enter API Key"
              secureTextEntry={true}
            />
            <CustomDropdown
              label="Region"
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
          </>
        );
      case 'ollama':
        return (
          <CustomTextInput
            label="Ollama API URL"
            value={ollamaApiUrl}
            onChangeText={setOllamaApiUrl}
            placeholder="Enter Ollama API URL"
          />
        );
      case 'deepseek':
        return (
          <CustomTextInput
            label="DeepSeek API Key"
            value={deepSeekApiKey}
            onChangeText={setDeepSeekApiKey}
            placeholder="Enter Deep Seek API Key"
            secureTextEntry={true}
          />
        );
      case 'openai':
        return (
          <>
            <CustomTextInput
              label="OpenAI API Key"
              value={openAIApiKey}
              onChangeText={setOpenAIApiKey}
              placeholder="Enter OpenAI API Key"
              secureTextEntry={true}
            />
            <View style={styles.proxySwitchContainer}>
              <Text style={styles.proxyLabel}>Use Proxy</Text>
              <Switch
                style={[isMac ? styles.switch : {}]}
                value={openAIProxyEnabled}
                onValueChange={toggleOpenAIProxy}
              />
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.tabContainer}>
          <TabButton
            label={isMac ? 'Amazon Bedrock' : 'Bedrock'}
            isSelected={selectedTab === 'bedrock'}
            onPress={() => setSelectedTab('bedrock')}
          />
          <TabButton
            label="Ollama"
            isSelected={selectedTab === 'ollama'}
            onPress={() => setSelectedTab('ollama')}
          />
          <TabButton
            label="DeepSeek"
            isSelected={selectedTab === 'deepseek'}
            onPress={() => setSelectedTab('deepseek')}
          />
          <TabButton
            label="OpenAI"
            isSelected={selectedTab === 'openai'}
            onPress={() => setSelectedTab('openai')}
          />
        </View>

        <View style={styles.providerSettingsContainer}>
          {renderProviderSettings()}
        </View>

        <Text style={[styles.label, styles.middleLabel]}>Select Model</Text>
        <CustomDropdown
          label="Text Model"
          data={textModelsData}
          value={selectedTextModel.modelId}
          onChange={(item: DropdownItem) => {
            if (item.value !== '') {
              const selectedModel = textModels.find(
                model => model.modelId === item.value
              );
              setSelectedTextModel(selectedModel!);
              if (selectedModel) {
                saveTextModel(selectedModel);
              }
            }
          }}
          placeholder="Select a model"
        />
        {selectedTextModel &&
          BedrockThinkingModels.includes(selectedTextModel.modelName) && (
            <View style={styles.thinkingSwitchContainer}>
              <Text style={styles.proxyLabel}>Enable Thinking</Text>
              <Switch
                style={[isMac ? styles.switch : {}]}
                value={thinkingEnabled}
                onValueChange={toggleThinking}
              />
            </View>
          )}

        <CustomDropdown
          label="Image Model"
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
          label="Image Size"
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
  firstLabel: {
    marginBottom: 12,
  },
  middleLabel: {
    marginTop: 10,
    marginBottom: 12,
  },
  proxyLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: 'black',
    marginLeft: 2,
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
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  proxySwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 0,
  },
  thinkingSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  apiKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  apiKeyInputContainer: {
    flex: 1,
    marginRight: 10,
  },
  proxyContainer: {
    marginBottom: 12,
  },
  proxyMacContainer: {
    marginTop: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    marginHorizontal: Platform.OS === 'ios' ? -2 : 0,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    padding: 6,
  },
  providerSettingsContainer: {
    marginBottom: 8,
  },
  switch: {
    marginRight: -14,
    width: 32,
    height: 32,
  },
});

export default SettingsScreen;
