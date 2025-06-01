import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { isMac } from '../../App.tsx';

interface AudioWaveformProps {
  volume?: number; // Volume level between 1-10
}

const AudioWaveformComponent: React.FC<AudioWaveformProps> = ({
  volume = 1,
}) => {
  const [colorOffset, setColorOffset] = useState(0);
  const barCount = isMac ? 48 : 32;
  // Single shared value for all bars
  const barHeights = useSharedValue(Array(barCount).fill(0.3));

  // Gradient colors from blue to green to purple
  const gradientColors = [
    '#4158D0',
    '#4B5EE8',
    '#5564FF',
    '#5F6CFF',
    '#6975FF',
    '#737EFF',
    '#7D87FF',
    '#8790FF',
    '#90A0FF',
    '#8BAFFF',
    '#86BEFF',
    '#80CDFF',
    '#7ADCFF',
    '#74EBFF',
    '#6EFAFF',
    '#68FFFC',
    '#60F5F0',
    '#58F0E0',
    '#50EBD0',
    '#48E6C0',
    '#40E1B0',
    '#38DCA0',
    '#30D790',
    '#29D280',
    '#21CD70',
    '#41D46C',
    '#61DB68',
    '#81E264',
    '#A1E960',
    '#B0ED5C',
    '#C0F158',
    '#D0F554',
    '#C8F050',
    '#BEC24C',
    '#B49448',
    '#AA6644',
    '#A03840',
    '#963A60',
    '#8C3C80',
    '#823EA0',
    '#7840C0',
    '#7E4CD8',
    '#8458F0',
    '#8A64FF',
    '#9070FF',
    '#967CFF',
    '#9C88FF',
    '#4158D0',
  ];

  // Color animation effect - updates every 500ms
  useEffect(() => {
    const colorAnimationInterval = setInterval(() => {
      setColorOffset(prev => (prev + 1) % gradientColors.length);
    }, 500);

    return () => clearInterval(colorAnimationInterval);
  }, [gradientColors.length]);

  // Update waveform when volume changes
  useEffect(() => {
    const newHeights = [...barHeights.value];

    // Special handling for volume=1 (silent or not recording)
    if (volume === 1) {
      const minHeight = 0.05;
      for (let i = 0; i < barCount; i++) {
        newHeights[i] = minHeight;
      }

      barHeights.value = withTiming(newHeights, {
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      return;
    }

    // For volume > 1, animate based on volume level
    const baseIntensity = volume / 10;

    // First phase: set random heights for each bar
    for (let i = 0; i < barCount; i++) {
      const centerEffect =
        1 - Math.abs((i - barCount / 2) / (barCount / 2)) * 0.5;
      newHeights[i] =
        (Math.random() * 0.6 + 0.2) * baseIntensity * centerEffect;
    }

    // Apply first phase animation with longer duration
    barHeights.value = withTiming(newHeights, {
      duration: 280,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    // Use setTimeout to execute second phase animation
    setTimeout(() => {
      const secondPhaseHeights = [...barHeights.value];

      for (let i = 0; i < barCount; i++) {
        secondPhaseHeights[i] = 0.05 + Math.random() * 0.15 * baseIntensity;
      }

      // Apply second phase animation with longer duration
      barHeights.value = withTiming(secondPhaseHeights, {
        duration: 400,
        easing: Easing.bezier(0.3, 0.1, 0.4, 1),
      });
    }, 500);
  }, [barHeights, volume, barCount]);

  // Create a function that returns animated style based on index
  const getAnimatedStyle = (index: number) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAnimatedStyle(() => ({
      height: `${barHeights.value[index] * 100}%`,
      opacity: 0.7 + barHeights.value[index] * 0.3,
    }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.waveformContainer}>
        {Array(barCount)
          .fill(0)
          .map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.bar,
                getAnimatedStyle(index),
                {
                  backgroundColor:
                    gradientColors[
                      (index + colorOffset) % gradientColors.length
                    ],
                },
              ]}
            />
          ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 16,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    width: '100%',
  },
  bar: {
    width: 3,
    borderRadius: 3,
    minHeight: 1,
  },
  baselineContainer: {
    position: 'absolute',
    bottom: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  baseline: {
    height: 1,
    width: '95%',
    backgroundColor: 'rgba(120, 120, 255, 0.3)',
  },
});

export default AudioWaveformComponent;
