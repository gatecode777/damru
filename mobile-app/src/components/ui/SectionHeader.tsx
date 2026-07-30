import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from './Image';
import { Colors, Typography } from '../../constants/theme';
import { StaticAssets } from '../../constants/assets';

interface SectionHeaderProps {
  subheading?: string;
  title: string;
  subtitle?: string;
  showLeaf?: boolean;
  align?: 'center' | 'left';
}

export function SectionHeader({ subheading, title, subtitle, showLeaf = true, align = 'center' }: SectionHeaderProps) {
  const isCenter = align === 'center';

  return (
    <View style={[styles.container, isCenter && styles.centerAlign]}>
      {showLeaf && (
        <View style={styles.leafRow}>
          <Image source={StaticAssets.leafA} style={styles.leafIcon} contentFit="contain" />
          {subheading && <Text style={Typography.subheading}>{subheading}</Text>}
          <Image source={StaticAssets.leafB} style={styles.leafIcon} contentFit="contain" />
        </View>
      )}
      {!showLeaf && subheading && <Text style={Typography.subheading}>{subheading}</Text>}

      <Text style={[Typography.h2, isCenter && styles.centerText, styles.title]}>{title}</Text>
      {subtitle && <Text style={[Typography.body, isCenter && styles.centerText, styles.subtitle]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  centerAlign: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  leafRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  leafIcon: {
    width: 20,
    height: 14,
  },
  title: {
    marginTop: 4,
    color: Colors.text,
  },
  subtitle: {
    marginTop: 4,
    color: Colors.text2,
  },
});
