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
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
  { _id: "cat_soup", name: "Soup", slug: "soup", description: "Warm your soul with our signature broths" },
  { _id: "cat_salads", name: "Salads", slug: "salads", description: "Fresh and crisp greens tossed with artisanal dressings" },
  { _id: "cat_maggi", name: "Maggi", slug: "maggi", description: "Your favorite comfort food prepared with a special fusion twist" },
  { _id: "cat_fries", name: "Fries", slug: "fries", description: "Golden, crispy potato fries tossed in selected spices" },
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState(params.q || "");
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

  // Sync search query from route parameters if it changes
  useEffect(() => {
    if (params.q !== undefined) {
      setSearchQuery(params.q);
    }
  }, [params.q]);

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

  // Filter products based on selected category or search query
  const filteredProducts = allItems.filter((item) => {
    const matchesSearch =
      searchQuery.trim().length < 2 ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.desc || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      searchQuery.trim().length >= 2 || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const activeCategoryObj = categories.find((c) => c._id === selectedCategory);

  const renderHeader = () => (
    <>
      <MenuHeroSection />

      {/* Search Input Box */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search for dishes..."
            placeholderTextColor="#a99c94"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#a99c94" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Category Tabs Row */}
      {categories.length > 0 && searchQuery.trim().length < 2 && (
        <MenuCategoryTabs
          categories={categories}
          activeId={selectedCategory}
          onSelect={setSelectedCategory}
        />
      )}

      {/* Dynamic Category Header */}
      {activeCategoryObj && searchQuery.trim().length < 2 && (
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
                  message={
                    searchQuery.trim().length >= 2
                      ? `No items found matching "${searchQuery}".`
                      : "We are currently updating this category's dishes."
                  }
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
  searchContainer: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: colors.ink,
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
