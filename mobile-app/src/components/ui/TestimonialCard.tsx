import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Layout } from '../../constants/theme';

interface TestimonialCardProps {
  name: string;
  review: string;
  rating?: number;
  role?: string;
}

export function TestimonialCard({ name, review, rating = 5, role }: TestimonialCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.starsRow}>
        {Array.from({ length: rating }).map((_, i) => (
          <Ionicons key={i} name="star" size={16} color={Colors.star} />
        ))}
      </View>

      <Text style={styles.quoteText}>"{review}"</Text>

      <View style={styles.authorBox}>
        <Text style={Typography.bodyBold}>{name}</Text>
        {role ? <Text style={Typography.caption}>{role}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.text2,
    lineHeight: 20,
  },
  authorBox: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
  },
});
