import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { TapGestureHandler, State } from 'react-native-gesture-handler';

interface HeaderTitleProps {
  title: string;
  onDoubleTap: () => void;
}

const HeaderTitle: React.FC<HeaderTitleProps> = ({ title, onDoubleTap }) => {
  return (
    <TapGestureHandler
      numberOfTaps={2}
      onHandlerStateChange={({ nativeEvent }) => {
        if (nativeEvent.state === State.ACTIVE) {
          onDoubleTap();
        }
      }}>
      <Text style={styles.headerTitleStyle}>{title}</Text>
    </TapGestureHandler>
  );
};

const styles = StyleSheet.create({
  headerTitleStyle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'black',
  },
});

export default HeaderTitle;
