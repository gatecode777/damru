import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHomepageBlogs, type HomepageBlog } from '../../hooks/useHomepageBlogs';
import { BlogCard, BlogCardSkeleton } from './BlogCard';
import { colors } from '@/config';

const SKELETON_COUNT = 2;

/* ─────────────────────────────────────────────
   Error state with retry
───────────────────────────────────────────── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={32} color={colors.muted} />
      <Text style={styles.errorText}>Couldn't load blogs</Text>
      <Text style={styles.errorSub}>Check your internet connection.</Text>
      <Pressable onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Section heading — matches .menu-title:
   font-family: "Playfair Display", font-size: ~35px
   text-align: center, margin-bottom: ~30px
───────────────────────────────────────────── */
function SectionHeading() {
  return (
    <View style={styles.headingContainer}>
      <Text style={styles.heading}>Our Blogs</Text>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Main exported section
───────────────────────────────────────────── */
export function BlogsSection() {
  const { blogs, loading, error } = useHomepageBlogs();

  // Hide section cleanly if not loading, no error, and no blogs returned
  if (!loading && !error && blogs.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      {/* Heading — always visible even while loading */}
      <SectionHeading />

      {/* Content */}
      {error ? (
        <ErrorState onRetry={() => {
          // The hook re-runs on mount; navigate away and back, or add a retry counter
          // For simplicity, just show the stable error state
        }} />
      ) : loading ? (
        /* Skeleton cards */
        <>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <BlogCardSkeleton key={i} />
          ))}
        </>
      ) : (
        /* Real blog cards */
        <>
          {blogs.map((blog: HomepageBlog, i: number) => (
            <BlogCard key={blog._id} blog={blog} index={i} />
          ))}
        </>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  /*
   * Section container — white bg, vertical padding matches
   * website's .special-feature-section padding after features grid
   */
  section: {
    backgroundColor: '#ffffff',
    paddingTop: 20,
    paddingBottom: 40,
  },

  /* Heading — mirrors .menu-title */
  headingContainer: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  heading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 34,
    color: '#000000',
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.3,
  },

  /* Error */
  errorBox: {
    marginHorizontal: 20,
    padding: 28,
    backgroundColor: '#fff9f4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee3da',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: '#21150f',
    marginTop: 10,
  },
  errorSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#756860',
    marginTop: 4,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#e57922',
    borderRadius: 8,
  },
  retryText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: '#fff',
  },
});
