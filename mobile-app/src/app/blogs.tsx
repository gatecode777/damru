import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";

import { HomeHeader } from "../components/home/HomeHeader";
import { EmptyState } from "../components/ui";
import { getWebImageUri } from "../constants/assets";
import { publicGet } from "../lib/api";
import { colors } from "../config";

interface BlogAuthor {
  name: string;
  avatar: string;
}

interface Blog {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  coverImageAlt?: string;
  author: BlogAuthor;
  readTime: number;
  publishedAt: string;
  category: string;
}

const AVATAR_FALLBACK = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200";
const IMG_FALLBACK = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80";

const STATIC_FALLBACK: Blog[] = [
  {
    _id: "f1",
    title: "Fruit and vegetables and protection against diseases",
    slug: "fruit-and-vegetables-protection",
    excerpt: "A healthy blend of fresh fruits and vegetables packed with nutrients that support immunity and overall well-being.",
    coverImage: "",
    author: {
      name: "Damru By Namo",
      avatar: "",
    },
    readTime: 3,
    publishedAt: new Date().toISOString(),
    category: "Healthy Food",
  },
  {
    _id: "f2",
    title: "The Ultimate Guide to Pure Vegetarian Diet & Nutrition",
    slug: "vegetarian-diet-nutrition-guide",
    excerpt: "Explore the health benefits of a pure vegetarian diet, rich protein sources, and nutrient balances for an active lifestyle.",
    coverImage: "",
    author: {
      name: "Chef Namo",
      avatar: "",
    },
    readTime: 5,
    publishedAt: new Date().toISOString(),
    category: "Nutrition",
  },
  {
    _id: "f3",
    title: "Jaipur Food Culture: History of Traditional Recipes",
    slug: "jaipur-traditional-food-culture",
    excerpt: "Dive into the rich history of traditional Rajasthani dishes, dynamic spice blend methods, and the evolution of taste in Pink City.",
    coverImage: "",
    author: {
      name: "Damru Team",
      avatar: "",
    },
    readTime: 4,
    publishedAt: new Date().toISOString(),
    category: "Culture",
  },
];

export default function BlogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Load paginated blogs or search results
  useEffect(() => {
    let active = true;
    setLoading(true);

    if (query.trim().length >= 2) {
      // Fetch Search Results
      const delayTimer = setTimeout(() => {
        publicGet<{ results: any[] }>(`/api/blog-search?q=${encodeURIComponent(query.trim())}`)
          .then((d) => {
            if (!active) return;
            const normalized = (d.results || []).map((b) => ({
              _id: String(b._id),
              title: b.title ?? "",
              slug: b.slug ?? "",
              excerpt: b.excerpt ?? "",
              coverImage: b.coverImage ?? "",
              author: {
                name: b.author?.name ?? "Damru By Namo",
                avatar: b.author?.image ?? b.author?.avatar ?? "",
              },
              readTime: b.readTime ?? 1,
              publishedAt: b.publishedAt ? String(b.publishedAt) : String(b.createdAt),
              category: b.category?.name ?? "Healthy Food",
            }));
            setBlogs(normalized);
            setTotalPages(1); // Search results are single-page
          })
          .catch((err) => {
            console.error("❌ [BlogsScreen] Search failed:", err);
            if (active) setBlogs([]);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      }, 350);

      return () => {
        active = false;
        clearTimeout(delayTimer);
      };
    } else {
      // Fetch Homepage Blogs Feed (already deployed on live server)
      publicGet<{ blogs: any[] }>("/api/homepage-blogs")
        .then((d) => {
          if (!active) return;
          if (d.blogs && d.blogs.length > 0) {
            setBlogs(d.blogs);
          } else {
            setBlogs(STATIC_FALLBACK);
          }
          setTotalPages(1);
        })
        .catch((err) => {
          console.error("❌ [BlogsScreen] Fetch failed:", err);
          if (active) setBlogs(STATIC_FALLBACK);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }
  }, [page, query]);

  function formatDate(d?: string) {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  function handleReadMore(blog: Blog) {
    router.push(`/blog/${blog.slug}`);
  }

  function handlePageChange(p: number) {
    if (p < 1 || p > totalPages || p === page || loading) return;
    setPage(p);
  }

  function renderBlogCard({ item, index }: { item: Blog; index: number }) {
    // Resolve cover image source
    const coverSource = item.coverImage
      ? { uri: getWebImageUri(`/uploads/blogs/${item.coverImage}`) + "?tr=w-400,h-260,fo-auto" }
      : { uri: IMG_FALLBACK };

    // Resolve author avatar source
    const avatarSource = item.author.avatar
      ? { uri: getWebImageUri(`/uploads/authors/${item.author.avatar}`) + "?tr=w-60,h-60,fo-auto" }
      : { uri: AVATAR_FALLBACK };

    return (
      <Animated.View
        entering={FadeInUp.delay(index * 100).duration(500)}
        style={styles.card}
      >
        <Pressable onPress={() => handleReadMore(item)} style={styles.cardPressable}>
          {/* Cover Image & Category Badge */}
          <View style={styles.imageContainer}>
            <Image
              source={coverSource}
              style={styles.coverImage}
              contentFit="cover"
              transition={200}
            />
            {item.category ? (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            ) : null}
          </View>

          {/* Card Details */}
          <View style={styles.cardBody}>
            {/* Author row info */}
            <View style={styles.authorRow}>
              <Image
                source={avatarSource}
                style={styles.authorAvatar}
                contentFit="cover"
              />
              <Text style={styles.authorMeta} numberOfLines={1}>
                {item.author.name} • {formatDate(item.publishedAt)}
              </Text>
            </View>

            {/* Title */}
            <Text style={styles.blogTitle}>{item.title}</Text>

            {/* Accent Dotted Divider Line */}
            <View style={styles.dottedDivider}>
              {Array.from({ length: 10 }).map((_, j) => (
                <View key={j} style={styles.dividerDot} />
              ))}
            </View>

            {/* Excerpt */}
            {item.excerpt ? (
              <Text style={styles.excerpt} numberOfLines={3}>
                {item.excerpt}
              </Text>
            ) : null}

            {/* Read More Link with blue arrow */}
            <View style={styles.readMoreRow}>
              <Text style={styles.readMoreText}>Read More</Text>
              <Ionicons name="arrow-forward" size={16} color="#4a6cf7" style={styles.arrowIcon} />
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  function renderPagination() {
    if (totalPages <= 1 || query.trim().length >= 2) return null;

    return (
      <View style={styles.paginationRow}>
        {/* Prev Button */}
        <Pressable
          style={[styles.pagBtn, page <= 1 && styles.pagBtnDisabled]}
          onPress={() => handlePageChange(page - 1)}
          disabled={page <= 1 || loading}
        >
          <Text style={[styles.pagBtnText, page <= 1 && styles.pagBtnTextDisabled]}>
            Prev
          </Text>
        </Pressable>

        {/* Page Numbers */}
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
          const isSelected = p === page;
          return (
            <Pressable
              key={p}
              style={[styles.pagNum, isSelected && styles.pagNumSelected]}
              onPress={() => handlePageChange(p)}
              disabled={loading}
            >
              <Text style={[styles.pagNumText, isSelected && styles.pagNumTextSelected]}>
                {p}
              </Text>
            </Pressable>
          );
        })}

        {/* Next Button */}
        <Pressable
          style={[styles.pagBtn, page >= totalPages && styles.pagBtnDisabled]}
          onPress={() => handlePageChange(page + 1)}
          disabled={page >= totalPages || loading}
        >
          <Text style={[styles.pagBtnText, page >= totalPages && styles.pagBtnTextDisabled]}>
            Next
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeHeader />

      <FlatList
        data={blogs}
        keyExtractor={(item) => item._id}
        renderItem={renderBlogCard}
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={5}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 85 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Breadcrumb row */}
            <View style={styles.breadcrumbContainer}>
              <Pressable onPress={() => router.push("/")} style={styles.breadcrumbPressable}>
                <Text style={styles.breadcrumbLink}>Home</Text>
              </Pressable>
              <Text style={styles.breadcrumbSep}> / </Text>
              <Text style={styles.breadcrumbCurrent}>Blog</Text>
            </View>

            {/* Search Input block */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color="#a99c94" />
              <TextInput
                value={query}
                onChangeText={(v) => {
                  setQuery(v);
                  setPage(1); // Reset page selection on input change
                }}
                placeholder="Search stories…"
                placeholderTextColor="#a99c94"
                style={styles.searchInput}
              />
            </View>

            {/* Loader indicator */}
            {loading ? (
              <ActivityIndicator
                size="small"
                color={colors.orange}
                style={styles.loader}
              />
            ) : null}
          </>
        }
        ListFooterComponent={renderPagination()}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="Discover a story"
              message={
                query.length >= 2
                  ? "No matching stories found."
                  : "We are updating our journal. Please check back later!"
              }
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  breadcrumbContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  breadcrumbPressable: {
    paddingVertical: 4,
  },
  breadcrumbLink: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: "#c8a96e",
  },
  breadcrumbSep: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#6b6560",
    marginHorizontal: 6,
  },
  breadcrumbCurrent: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.ink,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cream,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#e0d8ce",
    height: 50,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 28,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: colors.ink,
    height: "100%",
  },
  loader: {
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e3ddd6",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressable: {
    width: "100%",
  },
  imageContainer: {
    width: "100%",
    height: 220,
    position: "relative",
    backgroundColor: "#faf8f5",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  categoryBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: colors.orange,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  categoryText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11.5,
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 20,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f0ece6",
  },
  authorMeta: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#6b6560",
    flex: 1,
  },
  blogTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 21,
    color: colors.ink,
    lineHeight: 28,
    marginBottom: 10,
  },
  dottedDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginVertical: 12,
  },
  dividerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#c8a96e",
    opacity: 0.7,
  },
  excerpt: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13.5,
    color: "#6b6560",
    lineHeight: 22,
    marginBottom: 16,
    textAlign: "justify",
  },
  readMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  readMoreText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13.5,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  arrowIcon: {
    marginTop: 1,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 20,
  },
  pagBtn: {
    borderWidth: 1.5,
    borderColor: "#e0d8ce",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
  },
  pagBtnDisabled: {
    opacity: 0.5,
    backgroundColor: "#f5f3f0",
  },
  pagBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13.5,
    color: colors.ink,
  },
  pagBtnTextDisabled: {
    color: "#aaa",
  },
  pagNum: {
    borderWidth: 1.5,
    borderColor: "#e0d8ce",
    borderRadius: 6,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  pagNumSelected: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  pagNumText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13.5,
    color: colors.ink,
  },
  pagNumTextSelected: {
    color: "#ffffff",
    fontFamily: "Poppins_700Bold",
  },
});
