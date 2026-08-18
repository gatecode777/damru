import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HomeHeader } from "../../components/home/HomeHeader";
import { EmptyState } from "../../components/ui";
import { MenuHeroSection } from "../../components/menu/MenuHeroSection";
import { MenuCategoryTabs } from "../../components/menu/MenuCategoryTabs";
import { MenuProductCard } from "../../components/menu/MenuProductCard";
import { MenuReservationSection } from "../../components/menu/MenuReservationSection";
import { MenuProductSkeleton } from "../../components/menu/MenuProductSkeleton";
import { publicGet } from "../../lib/api";
import { colors } from "../../config";
import { useApp } from "../../providers/AppProvider";
import type { MenuItem } from "../../types";

interface Category {
  _id: string;
  name: string;
  slug: string;
  description: string;
}

const FALLBACK_CATEGORIES: Category[] = [
  { _id: "cat_soup", name: "Soup", slug: "soup", description: "Warm your soul with our comforting, fresh, and aromatic signature broths." },
  { _id: "cat_salads", name: "Salads", slug: "salads", description: "Crisp, fresh greens and garden vegetables tossed with light dressings." },
  { _id: "cat_maggi", name: "Maggi", slug: "maggi", description: "Classic instant comfort noodles prepared with a special fusion twist." },
  { _id: "cat_fries", name: "Fries", slug: "fries", description: "Golden, crispy potato fries tossed in selected spices and seasonings." },
];

const FALLBACK_ITEMS: MenuItem[] = [
  {
    _id: "soup_tomato",
    name: "Cream Of Tomato",
    description: "A velvety smooth tomato soup infused with herbs.",
    image: "tomato-soup.jpg",
    price: 299,
    category: "cat_soup",
    isVeg: true,
  },
  {
    _id: "soup_mushroom",
    name: "Burnt Garlic Mushroom",
    description: "A deeply flavorful soup infused with roasted garlic.",
    image: "mushroom-soup.jpg",
    price: 299,
    category: "cat_soup",
    isVeg: true,
  },
  {
    _id: "soup_manchow",
    name: "Manchow Soup",
    description: "A bold and spicy Indo-Chinese classic with crispy noodles.",
    image: "manchow-soup.jpg",
    price: 297,
    category: "cat_soup",
    isVeg: true,
  },
  {
    _id: "soup_lemon",
    name: "Lemon Coriander",
    description: "A light and healthy Indo-style clear soup with zesty citrus.",
    image: "lemon-coriander.jpg",
    price: 299,
    category: "cat_soup",
    isVeg: true,
  },
  {
    _id: "salad_green",
    name: "Garden Fresh Green Salad",
    description: "Crispy cucumber, tomatoes, carrots, and onions served with lime.",
    image: "green-salad.jpg",
    price: 180,
    category: "cat_salads",
    isVeg: true,
  },
  {
    _id: "salad_caesar",
    name: "Classic Caesar Salad",
    description: "Romaine lettuce, crunchy croutons, and parmesan cheese tossed in caesar dressing.",
    image: "caesar-salad.jpg",
    price: 250,
    category: "cat_salads",
    isVeg: true,
  },
  {
    _id: "maggi_masala",
    name: "Double Masala Veg Maggi",
    description: "Noodles prepared with double spices and freshly chopped seasonal veggies.",
    image: "masala-maggi.jpg",
    price: 150,
    category: "cat_maggi",
    isVeg: true,
  },
  {
    _id: "maggi_cheese",
    name: "Cheese Butter Maggi",
    description: "Rich and creamy noodles loaded with pure butter and grated cheese.",
    image: "cheese-maggi.jpg",
    price: 180,
    category: "cat_maggi",
    isVeg: true,
  },
  {
    _id: "fries_salted",
    name: "Classic Salted Fries",
    description: "Crispy golden potato fries lightly seasoned with sea salt.",
    image: "salted-fries.jpg",
    price: 140,
    category: "cat_fries",
    isVeg: true,
  },
  {
    _id: "fries_peri",
    name: "Peri Peri Spicy Fries",
    description: "Crispy fries tossed in hot and tangy African peri peri spice mix.",
    image: "peri-fries.jpg",
    price: 160,
    category: "cat_fries",
    isVeg: true,
  },
];

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryClient";
import { PremiumRefreshControl } from "../../components/ui/PremiumRefreshControl";

const StableHomeHeader = React.memo(HomeHeader);

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cart, addItem, setQuantity } = useApp();

  const cartRef = useRef(cart);
  const isNavigatingRef = useRef(false);
  const flatListRef = useRef<FlatList<MenuItem>>(null);
  const scrollOffsetRef = useRef(0);
  const pendingOffsetRestoreRef = useRef<number | null>(null);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.menu.list(),
    queryFn: () => publicGet<{ categories: Category[]; items: MenuItem[] }>("/api/menu"),
    staleTime: 5 * 60 * 1000, // 5 minutes stale
  });

  const loading = isLoading;
  const error = isError ? "Failed to load menu data. Please check your internet connection." : null;

  const categories = data?.categories || FALLBACK_CATEGORIES;
  const allItems = data?.items || FALLBACK_ITEMS;

  const [selectedCategory, setSelectedCategory] = useState<string>("");

  useEffect(() => {
    if (categories.length > 0) {
      const exists = categories.some((c) => c._id === selectedCategory);
      if (!exists) {
        setSelectedCategory(categories[0]._id);
      }
    }
  }, [categories, selectedCategory]);

  const handleRetry = () => {
    refetch();
  };

  const handleCategorySelect = useCallback((id: string) => {
    setSelectedCategory((current) => {
      if (current === id) return current;
      pendingOffsetRestoreRef.current = scrollOffsetRef.current;
      return id;
    });
  }, []);

  const preserveOffsetAfterCategoryChange = useCallback(() => {
    const offset = pendingOffsetRestoreRef.current;
    if (offset === null) return;
    pendingOffsetRestoreRef.current = null;
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset, animated: false });
    });
  }, []);

  // Filter products based on selected category
  const filteredProducts = useMemo(
    () => allItems.filter((item) => item.category === selectedCategory),
    [allItems, selectedCategory]
  );

  const activeCategoryObj = categories.find((c) => c._id === selectedCategory);

  const handleAdd = useCallback((item: MenuItem) => {
    addItem(item);
  }, [addItem]);

  const handleIncrement = useCallback((item: MenuItem) => {
    const entry = cartRef.current.find((c) => c.menuItemId === item._id);
    if (entry) {
      setQuantity(entry, entry.qty + 1);
    }
  }, [setQuantity]);

  const handleDecrement = useCallback((item: MenuItem) => {
    const entry = cartRef.current.find((c) => c.menuItemId === item._id);
    if (entry) {
      setQuantity(entry, entry.qty - 1);
    }
  }, [setQuantity]);

  const handleOrderNow = useCallback(async (item: MenuItem) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    try {
      const entry = cartRef.current.find((c) => c.menuItemId === item._id);
      const qty = entry ? entry.qty : 0;
      if (qty === 0) {
        await addItem(item);
      }
      router.push("/cart");
    } finally {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 500);
    }
  }, [addItem, router]);

  const renderProductItem = useCallback(({ item }: { item: MenuItem }) => {
    const cartEntry = cart.find((c) => c.menuItemId === item._id);
    const qty = cartEntry ? cartEntry.qty : 0;

    return (
      <MenuProductCard
        item={item}
        qty={qty}
        onAdd={handleAdd}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onOrderNow={handleOrderNow}
      />
    );
  }, [cart, handleAdd, handleIncrement, handleDecrement, handleOrderNow]);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <StableHomeHeader />

      {error ? (
        <View style={styles.errorContainer}>
          <EmptyState
            title="Menu Offline"
            message={error}
            actionLabel="Try Again"
            onAction={handleRetry}
          />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={loading ? [] : filteredProducts}
          keyExtractor={(item) => item._id}
          renderItem={renderProductItem}
          refreshControl={<PremiumRefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListHeaderComponent={
            <>
              <MenuHeroSection />

              {/* Category Tabs Row */}
              {categories.length > 0 && (
                <MenuCategoryTabs
                  categories={categories}
                  activeId={selectedCategory}
                  onSelect={handleCategorySelect}
                />
              )}

              {/* Dynamic Category Header */}
              {activeCategoryObj && (
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>{activeCategoryObj.name}</Text>
                  {activeCategoryObj.description ? (
                    <Text style={styles.categoryDesc}>{activeCategoryObj.description}</Text>
                  ) : null}
                </View>
              )}

              {/* Skeletons for Loading State */}
              {loading && (
                <View style={styles.skeletonList}>
                  <MenuProductSkeleton />
                  <MenuProductSkeleton />
                  <MenuProductSkeleton />
                  <MenuProductSkeleton />
                </View>
              )}
            </>
          }
          ListFooterComponent={!loading ? <MenuReservationSection /> : null}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <EmptyState
                  title="Craving something else?"
                  message="We are currently updating this category's dishes."
                />
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 85 },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          onContentSizeChange={preserveOffsetAfterCategoryChange}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={5}
          // Android clipping briefly detaches the hero and visible cells whenever
          // category data changes, which looks like a full-screen refresh.
          removeClippedSubviews={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  listContent: {
    backgroundColor: "#ffffff",
  },
  categoryHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  categoryTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: colors.orange,
    textAlign: "center",
    marginBottom: 6,
  },
  categoryDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: "85%",
  },
  skeletonList: {
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
  },
  emptyContainer: {
    paddingVertical: 40,
    backgroundColor: "#ffffff",
  },
});
