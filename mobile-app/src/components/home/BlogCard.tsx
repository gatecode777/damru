import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import {
  type HomepageBlog,
  fmtBlogDate,
  resolveBlogCover,
  resolveAuthorAvatar,
} from '../../hooks/useHomepageBlogs';

interface BlogCardProps {
  blog: HomepageBlog;
  /** 0-based — used for stagger animation delay */
  index: number;
}

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_MARGIN     = 20;
const CARD_WIDTH      = SCREEN_W - CARD_MARGIN * 2;
const IMAGE_HEIGHT    = 220;  // .blog-img-wrapper height: 250px → mobile proportional

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ─────────────────────────────────────────────
   Dotted divider — RN equivalent of CSS:
   background-image: radial-gradient(circle, #000 1.2px, transparent 1.2px)
   background-size: 7px 100%
   (already used pattern from BranchCard/IndoChineseProductCard)
───────────────────────────────────────────── */
function DottedDivider() {
  return (
    <View style={styles.dottedDivider} />
  );
}

/* ─────────────────────────────────────────────
   BlogCard — mirrors .blog-card exactly
───────────────────────────────────────────── */
export function BlogCard({ blog, index }: BlogCardProps) {
  /* ── Entrance animation — staggered fade + slide up ── */
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(28);

  useEffect(() => {
    const delay = index * 120;
    opacity.value    = withDelay(delay, withTiming(1,  { duration: 480, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(delay, withTiming(0,  { duration: 480, easing: Easing.out(Easing.quad) }));
  }, []);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  /* ── Press interaction ── */
  const cardScale   = useSharedValue(1);
  const arrowSlide  = useSharedValue(0);
  const shadowOp    = useSharedValue(0.05);

  const cardAnimStyle  = useAnimatedStyle(() => ({
    transform:     [{ scale: cardScale.value }],
    shadowOpacity: shadowOp.value,
  }));
  const arrowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowSlide.value }],
  }));

  const handlePressIn  = () => {
    cardScale.value  = withSpring(0.975, { damping: 18 });
    arrowSlide.value = withTiming(8,  { duration: 200 });
    shadowOp.value   = withTiming(0.12, { duration: 150 });
  };
  const handlePressOut = () => {
    cardScale.value  = withSpring(1, { damping: 15 });
    arrowSlide.value = withTiming(0, { duration: 200 });
    shadowOp.value   = withTiming(0.05, { duration: 200 });
  };

  const handlePress = () => {
    router.push({ pathname: '/blog/[slug]', params: { slug: blog.slug } } as any);
  };

  /* ── Resolved URLs ── */
  const coverUri  = resolveBlogCover(blog.coverImage);
  const avatarUri = resolveAuthorAvatar(blog.author.avatar);
  const dateStr   = fmtBlogDate(blog.publishedAt);

  return (
    <Animated.View style={[styles.cardWrapper, entranceStyle]}>
      <AnimatedPressable
        style={[styles.card, cardAnimStyle]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`Read blog: ${blog.title}`}
      >
        {/* ── Cover image + category badge ── */}
        <View style={styles.imageWrapper}>
          <Image
            source={coverUri ? { uri: coverUri } : undefined}
            style={styles.coverImage}
            resizeMode="cover"
            accessibilityLabel={blog.coverImageAlt || blog.title}
          />
          {blog.category ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{blog.category}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Blog info ── */}
        <View style={styles.info}>

          {/* Author row: avatar · name · date · readTime */}
          <View style={styles.authorRow}>
            <Image
              source={{ uri: avatarUri }}
              style={styles.avatar}
              resizeMode="cover"
              accessibilityLabel={`${blog.author.name} avatar`}
            />
            <Text style={styles.authorMeta} numberOfLines={1}>
              {blog.author.name}
              {dateStr ? ` • ${dateStr}` : ''}
              {` • ${blog.readTime} min read`}
            </Text>
          </View>

          {/* Blog title — .blog-info h3 */}
          <Text style={styles.title} numberOfLines={4}>
            {blog.title}
          </Text>

          {/* Dotted divider */}
          <DottedDivider />

          {/* Excerpt — .blog-desc */}
          {blog.excerpt ? (
            <Text style={styles.excerpt} numberOfLines={5}>
              {blog.excerpt}
            </Text>
          ) : null}

          {/* Read More — .read-more-link */}
          <View style={styles.readMoreRow}>
            <Text style={styles.readMoreText}>Read More</Text>
            <Animated.Text style={[styles.readMoreArrow, arrowAnimStyle]}>
              {'  →'}
            </Animated.Text>
          </View>

        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────
   Skeleton card shown while loading
───────────────────────────────────────────── */
export function BlogCardSkeleton() {
  return (
    <View style={[styles.cardWrapper]}>
      <View style={styles.card}>
        <View style={[styles.imageWrapper, { backgroundColor: '#f0f0f0' }]} />
        <View style={styles.info}>
          <View style={[styles.skeletonLine, { width: '70%', height: 12, marginBottom: 16 }]} />
          <View style={[styles.skeletonLine, { width: '100%', height: 18, marginBottom: 6 }]} />
          <View style={[styles.skeletonLine, { width: '85%', height: 18, marginBottom: 20 }]} />
          <View style={[styles.skeletonLine, { width: '100%', height: 1, marginBottom: 20 }]} />
          <View style={[styles.skeletonLine, { width: '100%', height: 12, marginBottom: 6 }]} />
          <View style={[styles.skeletonLine, { width: '100%', height: 12, marginBottom: 6 }]} />
          <View style={[styles.skeletonLine, { width: '80%',  height: 12, marginBottom: 20 }]} />
          <View style={[styles.skeletonLine, { width: '35%',  height: 14 }]} />
        </View>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Styles — direct CSS-to-RN mapping
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: CARD_MARGIN,
    marginBottom: 24,
  },

  /*
   * .blog-card:
   *   background: #fff
   *   border-radius: 8px
   *   box-shadow: 0 10px 30px rgba(0,0,0,0.05)
   *   border: 1px solid #f2f2f2
   *   overflow: hidden
   */
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f2f2f2',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },

  /*
   * .blog-img-wrapper:
   *   height: 250px → 220px on mobile (proportional)
   *   overflow: hidden
   */
  imageWrapper: {
    width: '100%',
    height: IMAGE_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },

  /*
   * .special-tag:
   *   position: absolute, top: 15, right: 15
   *   background: #e66a0d, color: #fff
   *   padding: 5px 15px, font-size: 12px, font-weight: 600
   *   border-radius: 3px
   */
  badge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: '#e66a0d',
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    lineHeight: 16,
  },

  /*
   * .blog-info: padding: 25px
   */
  info: {
    padding: 25,
  },

  /*
   * .author-meta:
   *   gap: 10px, font-size: 12px, color: #888, margin-bottom: 15px
   * .author-img: width: 30px, height: 30px, border-radius: 50%
   */
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#eee',
  },
  authorMeta: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: '#888888',
    lineHeight: 16,
  },

  /*
   * .blog-info h3:
   *   font-family: "Playfair Display"
   *   font-size: 1.4rem = 22.4px
   *   line-height: 1.3 = ~29px
   *   margin-bottom: 15px
   *   color: #111
   */
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    lineHeight: 29,
    color: '#111111',
    marginBottom: 15,
  },

  /*
   * .dotted-divider:
   *   width: 100%, height: 4px, margin-bottom: 20px
   *   radial-gradient dots → RN: borderStyle dotted
   */
  dottedDivider: {
    width: '100%',
    height: 0,
    borderStyle: 'dotted',
    borderBottomWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 1,
    marginBottom: 20,
  },

  /*
   * .blog-desc:
   *   font-size: ~14.4px → 14px
   *   color: #666, line-height: 1.5 = ~22px
   *   margin-bottom: 20px
   */
  excerpt: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#666666',
    lineHeight: 21,
    marginBottom: 20,
  },

  /*
   * .read-more-link:
   *   color: #111, font-weight: 600
   *   arrow span color: #3b82f6, font-size: 1.4rem
   */
  readMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readMoreText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: '#111111',
  },
  readMoreArrow: {
    fontSize: 20,
    color: '#3b82f6',   // exact blue from website
    lineHeight: 22,
  },

  /* Skeleton */
  skeletonLine: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
});
