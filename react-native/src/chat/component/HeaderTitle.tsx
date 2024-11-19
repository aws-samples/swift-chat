import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TapGestureHandler, State } from 'react-native-gesture-handler';
import { Usage } from '../../types/Chat.ts';

interface HeaderTitleProps {
  title: string;
  usage?: Usage;
  onDoubleTap: () => void;
}

const HeaderTitle: React.FC<HeaderTitleProps> = ({
  title,
  usage,
  onDoubleTap,
}) => {
  const [showUsage, setShowUsage] = useState(false);
  const doubleTapRef = useRef();

  const handleSingleTap = () => {
    setShowUsage(!showUsage);
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
          {showUsage && title === 'Chat' && (
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
    paddingHorizontal: 40,
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
