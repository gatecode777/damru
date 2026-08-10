import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { HomeHeader } from "@/components/home/HomeHeader";
import { EmptyState, ScreenTitle } from "@/components/ui";
import { assetUrl, colors } from "@/config";
import { get } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type { GalleryItem, GalleryTab } from "@/types";

const PAGE_SIZE = 10;
const FALLBACK_BANNER = "https://ik.imagekit.io/zp0tch54w/DAMRU/All%20menu%20page.webp";

export default function GalleryScreen() {
  const [activeKey, setActiveKey] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Cached via react-query so re-focusing the Gallery tab doesn't re-download
  // the whole collection every time.
  const { data, isLoading: loading } = useQuery({
    queryKey: queryKeys.gallery.list(),
    queryFn: () => get<{ tabs: GalleryTab[] }>("/api/gallery"),
    staleTime: 5 * 60 * 1000,
  });
  const tabs = data?.tabs ?? [];

  // Compute virtual "all" tab containing all items deduplicated & sorted by sortOrder
  const allTab: GalleryTab = useMemo(() => {
    const allItems: GalleryItem[] = [];
    const seenIds = new Set<string>();

    tabs.forEach((t) => {
      (t.items ?? []).forEach((item) => {
        if (item && item._id && !seenIds.has(item._id)) {
          seenIds.add(item._id);
          allItems.push(item);
        }
      });
    });

    allItems.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    return {
      _id: "all-virtual-tab",
      tabKey: "all",
      label: "All",
      bannerImage: "",
      bannerAlt: "All Gallery Images",
      isActive: true,
      sortOrder: -1,
      items: allItems,
    };
  }, [tabs]);

  // Combined tabs list starting with virtual "All" tab (excluding any duplicate DB "all" tab)
  const allTabsList = useMemo(() => {
    const dbTabs = tabs.filter(
      (t) => t.tabKey !== "all" && t.label.toLowerCase() !== "all"
    );
    return [allTab, ...dbTabs];
  }, [allTab, tabs]);

  // Active tab object
  const activeTab = useMemo(
    () => allTabsList.find((t) => t.tabKey === activeKey) ?? allTab,
    [allTabsList, activeKey, allTab]
  );

  // Items sorted by sortOrder for current active tab
  const sortedItems = useMemo(() => {
    const rawItems = activeTab?.items ?? [];
    return [...rawItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [activeTab]);

  // Visible items slice based on visibleCount
  const visibleItems = useMemo(
    () => sortedItems.slice(0, visibleCount),
    [sortedItems, visibleCount]
  );

  // Check if more items are available
  const hasMore = sortedItems.length > visibleCount;
  const remainingCount = sortedItems.length - visibleCount;

  // Switch filter tab & reset pagination
  const handleSwitchTab = (key: string) => {
    setActiveKey(key);
    setVisibleCount(PAGE_SIZE);
  };

  // Load more handler
  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  };

  // Banner image URI
  const bannerUri = useMemo(() => {
    if (activeTab?.bannerImage) {
      return assetUrl("gallery", activeTab.bannerImage) ?? FALLBACK_BANNER;
    }
    return FALLBACK_BANNER;
  }, [activeTab]);

  return (
    <View style={styles.container}>
      <HomeHeader />

      <FlatList
        data={loading ? [{ _id: "s1" }, { _id: "s2" }] as any[] : visibleItems}
        keyExtractor={(item, idx) => item._id ?? `gallery-item-${idx}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerComponent}>
            {/* Hero Banner Section */}
            <View style={styles.heroWrapper}>
              {loading ? (
                <View style={[styles.heroBannerImg, { backgroundColor: '#f0ece6' }]} />
              ) : (
                <Image
                  source={{ uri: bannerUri }}
                  style={styles.heroBannerImg}
                  contentFit="cover"
                  contentPosition="left center"
                />
              )}
            </View>

            {/* Horizontal Scrollable Category Filter Tabs */}
            <View style={styles.filterBarContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollView}
              >
                {allTabsList.map((tab) => {
                  const isActive = activeKey === tab.tabKey;
                  return (
                    <Pressable
                      key={tab.tabKey}
                      onPress={() => handleSwitchTab(tab.tabKey)}
                      style={styles.filterTabPressable}
                      disabled={loading}
                    >
                      <Text
                        style={[
                          styles.filterTabText,
                          isActive && styles.filterTabTextActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                      {isActive && <View style={styles.activeUnderline} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="No images in this category"
              message="Check back soon for new gallery additions."
            />
          ) : null
        }
        renderItem={({ item }) => {
          if (loading) {
            return (
              <View style={[styles.cardContainer, { backgroundColor: '#f0ece6' }]} />
            );
          }

          const isTopAligned = item.overlayClass === "top-aligned";
          const imageUrl = assetUrl("gallery", item.image);

          return (
            <Pressable
              style={styles.cardContainer}
              onPress={() => router.push("/menu")}
            >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.cardImg}
                  contentFit="cover"
                />

                <LinearGradient
                  colors={
                    isTopAligned
                      ? ["rgba(0, 0, 0, 0.75)", "transparent"]
                      : ["transparent", "rgba(0, 0, 0, 0.8)"]
                  }
                  style={[
                    styles.cardGradientOverlay,
                    isTopAligned
                      ? styles.overlayTopAligned
                      : styles.overlayBottomAligned,
                  ]}
                >
                  <View style={styles.cardContentCol}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {!!item.description && (
                      <Text style={styles.cardSubtitle}>{item.description}</Text>
                    )}
                  </View>

                  <View style={styles.arrowCircle}>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </Pressable>
            );
          }}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.footerContainer}>
                <Pressable style={styles.loadMoreBtn} onPress={handleLoadMore}>
                  <Text style={styles.loadMoreText}>
                    Load More ({remainingCount} remaining)
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 85,
  },
  headerComponent: {
    marginBottom: 16,
  },

  /* Hero Section */
  heroWrapper: {
    width: "100%",
    aspectRatio: 1.7,
    position: "relative",
    backgroundColor: "#FAF7F2",
  },
  heroBannerImg: {
    width: "100%",
    height: "100%",
  },

  /* Category Filter Tabs */
  filterBarContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  filterScrollView: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 20,
    alignItems: "center",
  },
  filterTabPressable: {
    alignItems: "center",
    paddingVertical: 4,
    position: "relative",
  },
  filterTabText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: "#666666",
  },
  filterTabTextActive: {
    fontFamily: "Poppins_700Bold",
    color: colors.orange,
  },
  activeUnderline: {
    position: "absolute",
    bottom: -6,
    height: 3,
    width: "100%",
    backgroundColor: colors.orange,
    borderRadius: 2,
  },

  /* Gallery Item Card */
  cardContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#FAF7F2",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  cardImg: {
    width: "100%",
    height: "100%",
  },
  cardGradientOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overlayBottomAligned: {
    bottom: 0,
    paddingTop: 40,
  },
  overlayTopAligned: {
    top: 0,
    paddingBottom: 40,
  },
  cardContentCol: {
    flex: 1,
    paddingRight: 12,
  },
  cardTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: "#FFFFFF",
    lineHeight: 28,
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#E0E0E0",
    opacity: 0.95,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Load More Footer */
  footerContainer: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreBtn: {
    borderWidth: 1.5,
    borderColor: colors.orange,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
  },
  loadMoreText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.orange,
  },
});
