import React, { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
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

export default function MenuScreen() {
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<Category[]>([]);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Menu Data (Categories & Products)
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    publicGet<{ categories: Category[]; items: MenuItem[] }>("/api/menu")
      .then((data) => {
        if (!active) return;
        setCategories(data.categories || []);
        setAllItems(data.items || []);
        if (data.categories && data.categories.length > 0) {
          setSelectedCategory(data.categories[0]._id);
        }
      })
      .catch((err) => {
        console.error("❌ [MenuScreen] Fetch failed:", err);
        if (active) {
          setCategories(FALLBACK_CATEGORIES);
          setAllItems(FALLBACK_ITEMS);
          setSelectedCategory(FALLBACK_CATEGORIES[0]._id);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    publicGet<{ categories: Category[]; items: MenuItem[] }>("/api/menu")
      .then((data) => {
        setCategories(data.categories || []);
        setAllItems(data.items || []);
        if (data.categories && data.categories.length > 0) {
          setSelectedCategory(data.categories[0]._id);
        }
      })
      .catch((err) => {
        console.error("❌ [MenuScreen] Retry fetch failed:", err);
        setCategories(FALLBACK_CATEGORIES);
        setAllItems(FALLBACK_ITEMS);
        setSelectedCategory(FALLBACK_CATEGORIES[0]._id);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Filter products based on selected category
  const filteredProducts = allItems.filter(
    (item) => item.category === selectedCategory
  );

  const activeCategoryObj = categories.find((c) => c._id === selectedCategory);

  const renderHeader = () => (
    <>
      <MenuHeroSection />

      {/* Category Tabs Row */}
      {categories.length > 0 && (
        <MenuCategoryTabs
          categories={categories}
          activeId={selectedCategory}
          onSelect={setSelectedCategory}
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
  );

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeHeader />

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
          data={loading ? [] : filteredProducts}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <MenuProductCard item={item} />}
          ListHeaderComponent={renderHeader}
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
