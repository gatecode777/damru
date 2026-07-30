import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from '../ui/Image';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '../../constants/theme';
import { LocalAssets } from '../../constants/assets';

interface FoodThumbnailSelectorProps {
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}

function ThumbnailItem({
  imgSource,
  isActive,
  onPress,
}: {
  imgSource: any;
  isActive: boolean;
  onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(isActive ? 1.12 : 1, {
            damping: 15,
            stiffness: 150,
          }),
        },
      ],
    };
  });

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={[
          styles.thumbBox,
          isActive ? styles.thumbActive : styles.thumbInactive,
          animatedStyle,
        ]}
      >
        <Image source={imgSource} style={styles.thumbImage} contentFit="cover" />
      </Animated.View>
    </Pressable>
  );
}

export function FoodThumbnailSelector({
  selectedIndex,
  onSelectIndex,
}: FoodThumbnailSelectorProps) {
  return (
    <View style={styles.row}>
      {LocalAssets.plates.map((plateSource, index) => (
        <ThumbnailItem
          key={index}
          imgSource={plateSource}
          isActive={selectedIndex === index}
          onPress={() => onSelectIndex(index)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginVertical: 18,
  },
  thumbBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  thumbInactive: {
    borderWidth: 2,
    borderColor: Colors.borderGray,
  },
  thumbActive: {
    borderWidth: 2.5,
    borderColor: Colors.primaryOrange,
    elevation: 3,
    shadowColor: Colors.primaryOrange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
});
