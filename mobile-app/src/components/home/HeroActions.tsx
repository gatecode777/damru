import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';

interface HeroActionsProps {
  onBookPress?: () => void;
  onMenuPress?: () => void;
}

export function HeroActions({ onBookPress, onMenuPress }: HeroActionsProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Primary Action Button */}
      <Pressable
        onPress={onBookPress || (() => router.push('/reserve'))}
        style={({ pressed }) => [styles.btnBook, pressed && styles.btnPressed]}
      >
        <Text style={styles.btnBookText}>Book a Table</Text>
      </Pressable>

      {/* Secondary Menu Link */}
      <Pressable
        onPress={onMenuPress || (() => router.push('/menu'))}
        style={({ pressed }) => [styles.btnMenu, pressed && styles.menuPressed]}
      >
        <Text style={styles.btnMenuText}>View Menu</Text>
        <Ionicons name="arrow-forward" size={16} color={Colors.darkText} style={styles.arrowIcon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 6,
    marginBottom: 24,
  },
  btnBook: {
    backgroundColor: Colors.primaryOrange,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: Colors.primaryOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  btnBookText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  btnMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  menuPressed: {
    opacity: 0.7,
  },
  btnMenuText: {
    color: Colors.darkText,
    fontSize: 14,
    fontWeight: '700',
  },
  arrowIcon: {
    marginLeft: 2,
  },
});
