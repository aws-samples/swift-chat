import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { Chat, ChatMode } from '../types/Chat.ts';
import {
  deleteMessagesBySessionId,
  getMessageList,
  getSessionId,
  updateMessageList,
} from '../storage/StorageUtils.ts';
import Dialog from 'react-native-dialog';
import { useAppContext } from './AppProvider.tsx';
import { trigger } from '../chat/util/HapticUtils.ts';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src';
import { groupMessagesByDate } from './HistoryGroupUtil.ts';

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = ({
  navigation,
}) => {
  const [groupChatHistory, setGroupChatHistory] = useState<Chat[]>([]);
  const groupChatHistoryRef = useRef(groupChatHistory);
  const chatHistoryRef = useRef(getMessageList());
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const deleteIdRef = useRef<number>(0);
  const drawerStatus = useDrawerStatus();
  const tapIndexRef = useRef<number>(1);
  const { sendEvent } = useAppContext();

  useEffect(() => {
    groupChatHistoryRef.current = groupChatHistory;
  }, [groupChatHistory]);

  useEffect(() => {
    if (drawerStatus === 'open') {
      trigger(HapticFeedbackTypes.soft);
      trigger(HapticFeedbackTypes.selection);
      if (
        groupChatHistoryRef.current.length > 1 &&
        getSessionId() === groupChatHistoryRef.current[1].id
      ) {
        return;
      }
      const messageList = getMessageList();
      chatHistoryRef.current = messageList;
      const flatListData = groupMessagesByDate(messageList);
      setGroupChatHistory(flatListData);
    } else {
      trigger(HapticFeedbackTypes.selection);
      trigger(HapticFeedbackTypes.soft);
    }
  }, [drawerStatus]);

  const handleDelete = () => {
    // update ui
    setGroupChatHistory(prevHistory =>
      prevHistory.filter(chat => chat.id !== deleteIdRef.current)
    );
    sendEvent('deleteChat', { id: deleteIdRef.current });

    // update storage
    chatHistoryRef.current = chatHistoryRef.current.filter(
      chat => chat.id !== deleteIdRef.current
    );
    updateMessageList(chatHistoryRef.current);
    deleteMessagesBySessionId(deleteIdRef.current);

    trigger(HapticFeedbackTypes.soft);
    deleteIdRef.current = 0;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={groupChatHistory}
        style={styles.flatList}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={
          <View>
            <TouchableOpacity
              style={styles.settingsTouch}
              onPress={() => {
                navigation.navigate('Bedrock', {
                  sessionId: -1,
                  tapIndex: -1,
                  mode: ChatMode.Text,
                });
              }}>
              <Image
                source={require('../assets/bedrock.png')}
                style={styles.settingsLeftImg}
              />
              <Text style={styles.settingsText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsTouch}
              onPress={() => {
                navigation.navigate('Bedrock', {
                  sessionId: -1,
                  tapIndex: -2,
                  mode: ChatMode.Image,
                });
              }}>
              <Image
                source={require('../assets/image.png')}
                style={styles.settingsLeftImg}
              />
              <Text style={styles.settingsText}>Image</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          if (item.id < 0) {
            return (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionDivider} />
                <Text style={styles.sectionText}>{item.title}</Text>
              </View>
            );
          } else {
            return (
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate('Bedrock', {
                    sessionId: item.id,
                    tapIndex: tapIndexRef.current,
                    mode: item.mode,
                  });
                  tapIndexRef.current += 1;
                }}
                onLongPress={event => {
                  trigger(HapticFeedbackTypes.notificationWarning);
                  event.preventDefault();
                  setShowDialog(true);
                  deleteIdRef.current = item.id;
                }}
                style={styles.touch}>
                <Text numberOfLines={1} style={styles.title}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          }
        }}
      />
      <TouchableOpacity
        style={styles.settingsTouch}
        onPress={() => {
          navigation.navigate('Settings');
        }}>
        <Image
          source={require('../assets/settings.png')}
          style={styles.settingsLeftImg}
        />
        <Text style={styles.settingsText}>Settings</Text>
      </TouchableOpacity>
      <Dialog.Container visible={showDialog}>
        <Dialog.Title>Delete Message</Dialog.Title>
        <Dialog.Description>You cannot undo this action.</Dialog.Description>
        <Dialog.Button
          label="Cancel"
          onPress={() => {
            setShowDialog(false);
          }}
        />
        <Dialog.Button
          label="Delete"
          onPress={() => {
            handleDelete();
            setShowDialog(false);
          }}
        />
      </Dialog.Container>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  settingsTouch: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 18,
  },
  settingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsText: {
    fontSize: 16,
    marginHorizontal: 8,
    fontWeight: '500',
    color: 'black',
  },
  settingsLeftImg: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  settingsRightImg: {
    width: 16,
    height: 16,
    marginRight: 8,
  },
  flatList: {
    marginVertical: 4,
  },
  touch: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginVertical: 4,
  },
  sectionContainer: {
    paddingHorizontal: 8,
    marginHorizontal: 12,
    marginVertical: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  sectionText: {
    marginTop: 17,
    fontSize: 14,
    color: 'grey',
  },
  title: {
    fontSize: 16,
    color: 'black',
  },
  rightAction: {
    backgroundColor: 'red',
    justifyContent: 'center',
    flex: 1,
    alignItems: 'flex-start',
  },
  actionText: {
    color: 'white',
    fontWeight: 'bold',
    padding: 20,
  },
});

export default CustomDrawerContent;
