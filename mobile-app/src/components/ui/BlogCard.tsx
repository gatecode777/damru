import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from './Image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Layout } from '../../constants/theme';

interface BlogCardProps {
  title: string;
  excerpt: string;
  coverImage: any;
  publishedAt?: string;
  authorName?: string;
  category?: string;
  onPress?: () => void;
}

export function BlogCard({ title, excerpt, coverImage, publishedAt, authorName, category, onPress }: BlogCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.imageBox}>
        <Image source={coverImage} style={styles.image} contentFit="cover" />
        {category ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{category}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.content}>
        <View style={styles.authorRow}>
          <Ionicons name="person-circle-outline" size={16} color={Colors.brand} />
          <Text style={styles.metaText}>{authorName || 'Damru By Namo'}</Text>
          {publishedAt ? <Text style={styles.metaText}>• {publishedAt}</Text> : null}
        </View>

        <Text style={Typography.h3} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.excerpt} numberOfLines={2}>
          {excerpt}
        </Text>

        <View style={styles.readMoreRow}>
          <Text style={styles.readMoreText}>READ MORE</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.brand} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
  },
  imageBox: {
    height: 150,
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: Colors.brand,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Layout.radiusSm,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  content: {
    padding: 14,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 12,
    color: Colors.text3,
  },
  excerpt: {
    fontSize: 13,
    color: Colors.text2,
    marginTop: 4,
    lineHeight: 18,
  },
  readMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand,
    letterSpacing: 0.5,
  },
});
