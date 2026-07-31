import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useBlogDetail,
  resolveBlogImage,
  resolveAuthorImage,
  fmtBlogDetailDate,
  type BlogSummary,
} from '../../hooks/useBlogDetail';
import { ContentBlock } from '../../components/blog/ContentBlock';
import { HomeHeader } from '../../components/home/HomeHeader';

const { width: SW } = Dimensions.get('window');
const CONTENT_WIDTH = SW - 40; // 20px padding each side
const COVER_HEIGHT = Math.round(CONTENT_WIDTH * 0.62);   // proportional to ~16:10 aspect ratio of content width
const API_URL_RAW  = process.env.EXPO_PUBLIC_API_URL ?? 'https://damrurestro.com';



/* ─────────────────────────────────────────────────────────────
   Recent post row card (sidebar "Recent Posted" in website)
───────────────────────────────────────────────────────────── */
function RecentCard({ post }: { post: BlogSummary }) {
  return (
    <Pressable
      style={styles.recentCard}
      onPress={() =>
        router.push({ pathname: '/blog/[slug]', params: { slug: post.slug } } as any)
      }
      accessibilityRole="button"
      accessibilityLabel={`Read: ${post.title}`}
    >
      <Image
        source={{ uri: resolveBlogImage(post.coverImage) }}
        style={styles.recentThumb}
        resizeMode="cover"
      />
      <View style={styles.recentInfo}>
        <Text style={styles.recentTitle} numberOfLines={3}>
          {post.title}
        </Text>
        <Text style={styles.recentMeta} numberOfLines={1}>
          {post.author.name} • {fmtBlogDetailDate(post.publishedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

/* ─────────────────────────────────────────────────────────────
   Prev / Next navigation card
───────────────────────────────────────────────────────────── */
function NavCard({
  post,
  direction,
}: {
  post: BlogSummary;
  direction: 'prev' | 'next';
}) {
  return (
    <Pressable
      style={styles.navCard}
      onPress={() =>
        router.push({ pathname: '/blog/[slug]', params: { slug: post.slug } } as any)
      }
      accessibilityRole="button"
      accessibilityLabel={`${direction === 'prev' ? 'Previous' : 'Next'} post: ${post.title}`}
    >
      <Image
        source={{ uri: resolveBlogImage(post.coverImage) }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.navOverlay} />
      <View style={styles.navContent}>
        <Text style={styles.navLabel}>
          {direction === 'prev' ? '← PREVIOUS POST' : 'NEXT POST →'}
        </Text>
        <Text style={styles.navTitle} numberOfLines={2}>
          {post.title}
        </Text>
      </View>
    </Pressable>
  );
}

/* ─────────────────────────────────────────────────────────────
   Skeleton loading state
───────────────────────────────────────────────────────────── */
function BlogDetailSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { paddingTop: insets.top + 56 }]}>
      <View style={[styles.skeletonBox, { height: COVER_HEIGHT, marginHorizontal: 0, borderRadius: 0 }]} />
      <View style={{ padding: 20 }}>
        <View style={[styles.skeletonBox, { width: 80, height: 12, marginBottom: 16 }]} />
        <View style={[styles.skeletonBox, { width: '95%', height: 28, marginBottom: 8 }]} />
        <View style={[styles.skeletonBox, { width: '75%', height: 28, marginBottom: 20 }]} />
        <View style={[styles.skeletonBox, { width: '60%', height: 12, marginBottom: 32 }]} />
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={[styles.skeletonBox, { height: 14, marginBottom: 10 }]} />
        ))}
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Not found state
───────────────────────────────────────────────────────────── */
function NotFound() {
  return (
    <View style={styles.centered}>
      <Ionicons name="document-text-outline" size={52} color="#ccc" />
      <Text style={styles.notFoundTitle}>Post not found</Text>
      <Text style={styles.notFoundSub}>
        This blog post may have been removed or the link is incorrect.
      </Text>
      <Pressable style={styles.backBtnFull} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Go Back</Text>
      </Pressable>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Error state with retry
───────────────────────────────────────────────────────────── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <Ionicons name="alert-circle-outline" size={52} color="#e67e22" />
      <Text style={styles.notFoundTitle}>Couldn't load post</Text>
      <Text style={styles.notFoundSub}>Check your internet and try again.</Text>
      <Pressable style={styles.backBtnFull} onPress={onRetry}>
        <Text style={styles.backBtnText}>Retry</Text>
      </Pressable>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main screen
───────────────────────────────────────────────────────────── */
export default function BlogDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { blog, recent, prev, next, loading, error } = useBlogDetail(slug ?? '');
  const insets = useSafeAreaInsets();

  const headerOpts = (
    <Stack.Screen options={{ headerShown: false }} />
  );

  /* ── Loading ── */
  if (loading) {
    return (
      <>
        {headerOpts}
        <HomeHeader />
        <BlogDetailSkeleton />
      </>
    );
  }

  /* ── Not found ── */
  if (error === 'not_found') {
    return (
      <>
        {headerOpts}
        <HomeHeader />
        <NotFound />
      </>
    );
  }

  /* ── Error ── */
  if (error || !blog) {
    return (
      <>
        {headerOpts}
        <HomeHeader />
        <ErrorState onRetry={() => {/* hook re-runs automatically on slug change */}} />
      </>
    );
  }

  const coverUri  = resolveBlogImage(blog.coverImage);
  const avatarUri = resolveAuthorImage(blog.author.image);
  const dateStr   = fmtBlogDetailDate(blog.publishedAt);

  return (
    <View style={styles.page}>
      {headerOpts}
      <HomeHeader />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* ── Breadcrumb ── */}
          <Text style={styles.breadcrumb}>
            <Text style={styles.breadcrumbLink}>Home</Text>
            <Text style={styles.breadcrumbSep}> / </Text>
            <Text style={styles.breadcrumbLink}>Blog</Text>
            <Text style={styles.breadcrumbSep}> / </Text>
            <Text style={styles.breadcrumbCurrent}>{blog.title}</Text>
          </Text>

          {/* ── Blog title (h1) ── */}
          <Text style={styles.title}>{blog.title}</Text>

          {/* ── Meta row: author • date • readTime ── */}
          <Text style={styles.meta}>
            By {blog.author.name}
            {dateStr ? ` • ${dateStr}` : ''}
            {` • ${blog.readTime} min read`}
          </Text>

          {/* ── Cover Image + Category badge ── */}
          <View style={styles.coverWrapper}>
            <Image
              source={{ uri: coverUri }}
              style={styles.coverImage}
              resizeMode="cover"
              accessibilityLabel={blog.coverImageAlt || blog.title}
            />
            {blog.category ? (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{blog.category}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Excerpt / intro ── */}
          {/* .sb-main__intro: Poppins 16px, color #444, margin-bottom 30 */}
          {blog.excerpt ? (
            <Text style={styles.excerpt}>{blog.excerpt}</Text>
          ) : null}

          {/* ── Content blocks ── */}
          {(blog.content ?? []).map((block, i) => (
            <ContentBlock key={i} block={block} />
          ))}

          {/* ── Tags ── */}
          {blog.tags?.length > 0 ? (
            <View style={styles.tagsRow}>
              {blog.tags.map(tag => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Author card ── */}
          {/* .sb-main__author: border-top #eee, padding 30 0, margin-top 50 */}
          <View style={styles.authorCard}>
            <Image
              source={{ uri: avatarUri }}
              style={styles.authorAvatar}
              resizeMode="cover"
              accessibilityLabel={blog.author.name}
            />
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{blog.author.name}</Text>
              {blog.author.designation ? (
                <Text style={styles.authorDesig}>{blog.author.designation}</Text>
              ) : null}
              {blog.author.bio ? (
                <Text style={styles.authorBio}>{blog.author.bio}</Text>
              ) : null}
            </View>
          </View>

          {/* ── Prev / Next navigation ── */}
          {(prev || next) ? (
            <View style={styles.navRow}>
              {prev ? <NavCard post={prev} direction="prev" /> : null}
              {next ? <NavCard post={next} direction="next" /> : null}
            </View>
          ) : null}

          {/* ── Recent posts ── */}
          {recent.length > 0 ? (
            <View style={styles.recentSection}>
              <Text style={styles.recentHeading}>Recent Posted</Text>
              <View style={styles.recentDivider} />
              {recent.map(r => (
                <RecentCard key={r._id} post={r} />
              ))}
            </View>
          ) : null}

        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  scrollContent: {
    paddingBottom: 40,
  },

  /* Breadcrumb */
  breadcrumb: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13.5,
    color: '#b0b0b0',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
    lineHeight: 20,
  },
  breadcrumbLink: {
    color: '#b0b0b0',
  },
  breadcrumbSep: {
    color: '#b0b0b0',
  },
  breadcrumbCurrent: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#111111',
  },

  /* Cover image */
  coverWrapper: {
    width: CONTENT_WIDTH,
    height: COVER_HEIGHT,
    position: 'relative',
    backgroundColor: '#f5f0eb',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 30,
  },
  coverImage: {
    width: CONTENT_WIDTH,
    height: COVER_HEIGHT,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: '#e66a0d',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 3,
  },
  categoryText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.5,
  },

  /* Content padding area */
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  /* .sb-page__main-title (mobile ≤767): Playfair Display 30px, #000, text-align center */
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    color: '#000',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 14,
  },

  /* Meta row */
  meta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  /* .sb-main__intro: Poppins 16px, color #444, margin-bottom 30 */
  excerpt: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: '#444',
    lineHeight: 26,
    marginBottom: 30,
  },

  /* Tags row */
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 24,
  },
  tagPill: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  tagText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12.8,
    color: '#6b7280',
  },

  /* .sb-main__author: border-top, margin-top 50, padding 30 0 */
  authorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 50,
    paddingTop: 30,
    paddingBottom: 30,
    flexWrap: 'wrap',
  },
  /* Mobile: 80×80 */
  authorAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
  },
  authorInfo: {
    flex: 1,
    minWidth: 180,
  },
  /* .sb-main__author h3 */
  authorName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: '#000',
    marginBottom: 4,
  },
  /* designation: color #e67e22 font-weight 600 */
  authorDesig: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#e67e22',
    marginBottom: 6,
  },
  /* .sb-main__author p: Poppins, #666 */
  authorBio: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },

  /* Prev/Next nav */
  navRow: {
    gap: 16,
    marginVertical: 24,
  },
  /* .sb-fullwidth__nav-box: min-height 160, cover image, dark overlay, border-radius 8 */
  navCard: {
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  navContent: {
    padding: 16,
    alignItems: 'center',
    zIndex: 2,
  },
  navLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 6,
  },
  navTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 15,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 22,
  },

  /* Recent Posted section */
  recentSection: {
    marginTop: 16,
    marginBottom: 24,
  },
  /* .sb-sidebar__title: Playfair Display 24px, #000, text-align center, padding-bottom 16, border-bottom */
  recentHeading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: '#000',
    textAlign: 'center',
    paddingBottom: 16,
    marginBottom: 20,
  },
  recentDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 20,
  },
  /* .sb-sidebar__post: flex row, gap 16, margin-bottom 20 */
  recentCard: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  /* .sb-sidebar__post img: 70×70, border-radius 2, cover */
  recentThumb: {
    width: 70,
    height: 70,
    borderRadius: 2,
    backgroundColor: '#f0f0f0',
  },
  recentInfo: {
    flex: 1,
  },
  /* .sb-sidebar__post-info h4: Poppins 500, 14px, #222 */
  recentTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#222',
    lineHeight: 20,
    marginBottom: 4,
  },
  /* small: color #999, 11px */
  recentMeta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#999',
  },

  /* Not found / error / loading states */
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#fff',
  },
  notFoundTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: '#111',
    marginTop: 16,
    marginBottom: 8,
  },
  notFoundSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  backBtnFull: {
    backgroundColor: '#e66a0d',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  backBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  skeletonBox: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    marginBottom: 8,
  },
});
