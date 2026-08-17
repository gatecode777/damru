import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHomepageBranches } from '../../hooks/useHomepageBranches';
import { BranchCard } from './BranchCard';
import { colors } from '@/config';

// Inline Card Skeleton for loading state
function BranchCardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonText, { width: '60%', height: 18, marginBottom: 8 }]} />
        <View style={[styles.skeletonText, { width: '40%', height: 14, marginBottom: 16 }]} />
        <View style={[styles.skeletonText, { width: '100%', height: 12, marginBottom: 6 }]} />
        <View style={[styles.skeletonText, { width: '100%', height: 12, marginBottom: 6 }]} />
        <View style={[styles.skeletonText, { width: '80%', height: 12 }]} />
      </View>
    </View>
  );
}

export function BranchesSection() {
  const { branches, loading, error } = useHomepageBranches();

  // If not loading, not error, and no branches are returned, hide the section cleanly
  if (!loading && !error && branches.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      {/* Section Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.heading}>Our Branches</Text>
        <View style={styles.dividerLine} />
        <Text style={styles.subtitle}>
          Serving delicious food and unforgettable moments at multiple locations
        </Text>
      </View>

      {/* Content Area */}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.muted} />
          <Text style={styles.errorText}>Could not load branches</Text>
          <Text style={styles.errorSub}>Please check your internet connection.</Text>
        </View>
      ) : loading ? (
        <View>
          <BranchCardSkeleton />
          <BranchCardSkeleton />
        </View>
      ) : (
        <View>
          {branches.map((branch, index) => (
            <BranchCard key={branch._id} branch={branch} index={index} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    paddingVertical: 50,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 24,
  },
  heading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 34,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 12,
  },
  dividerLine: {
    width: 60,
    height: 3,
    backgroundColor: colors.orange,
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: '#333333',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: '85%',
  },
  skeletonCard: {
    backgroundColor: colors.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 20,
    marginBottom: 25,
    overflow: 'hidden',
  },
  skeletonImage: {
    height: 200,
    backgroundColor: '#f5f6fa',
  },
  skeletonBody: {
    padding: 24,
  },
  skeletonText: {
    backgroundColor: '#f5f6fa',
    borderRadius: 4,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
  },
  errorText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.ink,
    marginTop: 12,
  },
  errorSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
});
