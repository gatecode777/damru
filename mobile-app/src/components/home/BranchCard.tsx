import React from 'react';
import { View, StyleSheet, Text, Pressable, Image, Linking } from 'react-native';
import { router } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { colors, assetUrl } from '@/config';
import type { Branch } from '@/types';

interface BranchCardProps {
  branch: Branch;
  index: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BranchCard({ branch, index }: BranchCardProps) {
  // Parse name and location if name contains parentheses
  const parts = branch.name.split('(');
  const displayName = parts[0]?.trim();
  const locationName = parts[1] ? `(${parts[1].trim()}` : '';

  // Fallback static images
  const staticImgs = [
    require('@/assets/images/OB1.png'),
    require('@/assets/images/OB2.png'),
    require('@/assets/images/OB3.png'),
  ];
  
  const imageSource = branch.cardImage
    ? { uri: assetUrl('branches', branch.cardImage) }
    : staticImgs[index % staticImgs.length];

  // Reanimated values for micro-animations
  const scale = useSharedValue(1);
  const arrowTranslate = useSharedValue(0);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const arrowAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: arrowTranslate.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15 });
    arrowTranslate.value = withTiming(6, { duration: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
    arrowTranslate.value = withTiming(0, { duration: 200 });
  };

  const handleReadMore = () => {
    router.push('/(tabs)/branches');
  };

  const handleCall = () => {
    const phone = branch.contact || branch.phone;
    if (phone) {
      Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
    }
  };

  return (
    <AnimatedPressable
      style={[styles.card, cardAnimatedStyle]}
      onPress={handleReadMore}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {/* Branch Image */}
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.image}
          resizeMode="cover"
          accessibilityLabel={branch.cardAlt || branch.name}
        />
      </View>

      {/* Card Content */}
      <View style={styles.content}>
        {/* Name and Location */}
        <Text style={styles.name}>{displayName}</Text>
        {locationName ? <Text style={styles.location}>{locationName}</Text> : null}

        {/* Dotted Divider */}
        <View style={styles.dottedDivider} />

        {/* Description */}
        <Text style={styles.description} numberOfLines={4}>
          {branch.description || branch.shortDescription}
        </Text>

        {/* Contact Info */}
        <View style={styles.contactContainer}>
          {(branch.contact || branch.phone) ? (
            <Pressable onPress={handleCall} style={styles.contactRow}>
              <Text style={styles.contactLabel}>Contact Us: </Text>
              <Text style={[styles.contactValue, styles.linkText]}>
                {branch.contact || branch.phone}
              </Text>
            </Pressable>
          ) : null}

          {branch.timing ? (
            <View style={styles.contactRow}>
              <Text style={styles.contactLabel}>Timing: </Text>
              <Text style={styles.contactValue}>{branch.timing}</Text>
            </View>
          ) : null}
        </View>

        {/* Read More Link */}
        <View style={styles.footer}>
          <Text style={styles.readMoreText}>Read More</Text>
          <Animated.Text style={[styles.arrow, arrowAnimatedStyle]}> →</Animated.Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    marginHorizontal: 20,
    marginBottom: 25,
    overflow: 'hidden',
    // Elevation for Android
    elevation: 4,
    // Shadows for iOS
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 24,
  },
  name: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: colors.ink,
    lineHeight: 26,
  },
  location: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 16,
    color: colors.ink,
    marginTop: 4,
    lineHeight: 22,
  },
  dottedDivider: {
    width: '100%',
    height: 0,
    borderStyle: 'dotted',
    borderWidth: 1.5,
    borderColor: '#eee3da', // matching theme colors.line
    borderRadius: 1,
    marginTop: 12,
    marginBottom: 16,
  },
  description: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#555555',
    lineHeight: 21,
    marginBottom: 16,
  },
  contactContainer: {
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  contactLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: colors.ink,
  },
  contactValue: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#000000',
  },
  linkText: {
    color: colors.orangeDark,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  readMoreText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.orange,
  },
  arrow: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: colors.orange,
    lineHeight: 18,
  },
});
