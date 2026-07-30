import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from './Image';
import { Colors, Layout } from '../../constants/theme';

interface CategoryCardProps {
  title: string;
  image: any;
  onPress?: () => void;
}

export function CategoryCard({ title, image, onPress }: CategoryCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Image source={image} style={styles.image} contentFit="cover" />
      <View style={styles.overlay} />
      <View style={styles.titleBadge}>
        <Text style={styles.titleText}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 120,
    borderRadius: Layout.radius,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  titleBadge: {
    backgroundColor: Colors.brand,
    alignSelf: 'flex-start',
    margin: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Layout.radiusSm,
  },
  titleText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
