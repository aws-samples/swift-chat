import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TapGestureHandler, State } from 'react-native-gesture-handler';
import { Usage } from '../../types/Chat.ts';

interface HeaderTitleProps {
  title: string;
  usage?: Usage;
  onDoubleTap: () => void;
  onShowSystemPrompt: () => void;
  isShowSystemPrompt: boolean;
}

const HeaderTitle: React.FC<HeaderTitleProps> = ({
  title,
  usage,
  onDoubleTap,
  onShowSystemPrompt,
  isShowSystemPrompt,
}) => {
  const [showUsage, setShowUsage] = useState(false);
  const doubleTapRef = useRef();

  const handleSingleTap = () => {
    if (!isShowSystemPrompt && !showUsage) {
      onShowSystemPrompt();
    } else {
      setShowUsage(!showUsage);
    }
  };

  return (
    <TapGestureHandler
      ref={doubleTapRef}
      numberOfTaps={2}
      onHandlerStateChange={({ nativeEvent }) => {
        if (nativeEvent.state === State.ACTIVE) {
          onDoubleTap();
        }
      }}>
      <TapGestureHandler
        numberOfTaps={1}
        onHandlerStateChange={({ nativeEvent }) => {
          if (nativeEvent.state === State.ACTIVE) {
            handleSingleTap();
          }
        }}
        waitFor={doubleTapRef}>
        <View style={styles.container}>
          <Text style={styles.headerTitleStyle}>{title}</Text>
          {showUsage && title !== 'Image' && (
            <Text style={styles.usageText}>{`Input: ${
              usage?.inputTokens ?? 0
            }   Output: ${usage?.outputTokens ?? 0}`}</Text>
          )}
        </View>
      </TapGestureHandler>
    </TapGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerTitleStyle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'black',
  },
  usageText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
    fontWeight: '400',
  },
});

export default HeaderTitle;
