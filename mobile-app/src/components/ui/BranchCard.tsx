import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Image } from './Image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Layout } from '../../constants/theme';

interface BranchCardProps {
  name: string;
  description: string;
  image: any;
  contact?: string;
  timing?: string;
  mapUrl?: string;
}

export function BranchCard({ name, description, image, contact, timing, mapUrl }: BranchCardProps) {
  const handleDirections = () => {
    if (mapUrl) {
      Linking.openURL(mapUrl);
    } else {
      Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(name + ' Jaipur')}`);
    }
  };

  return (
    <View style={styles.card}>
      <Image source={image} style={styles.image} contentFit="cover" />
      <View style={styles.content}>
        <Text style={Typography.h3}>{name}</Text>
        <Text style={styles.description} numberOfLines={3}>
          {description}
        </Text>

        <View style={styles.metaCol}>
          {timing ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={Colors.brand} />
              <Text style={styles.metaText}>{timing}</Text>
            </View>
          ) : null}

          {contact ? (
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={14} color={Colors.brand} />
              <Text style={styles.metaText}>{contact}</Text>
            </View>
          ) : null}
        </View>

        <Pressable onPress={handleDirections} style={styles.directionsBtn}>
          <Text style={styles.btnText}>GET DIRECTIONS</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.brand} />
        </Pressable>
      </View>
    </View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  image: {
    width: '100%',
    height: 150,
  },
  content: {
    padding: 14,
  },
  description: {
    fontSize: 13,
    color: Colors.text2,
    marginTop: 6,
    lineHeight: 18,
  },
  metaCol: {
    marginTop: 10,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: Colors.text2,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand,
    letterSpacing: 0.5,
  },
});
