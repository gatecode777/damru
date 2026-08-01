import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/providers/AppProvider";
import { publicGet } from "@/lib/api";
import { colors } from "@/config";
import type { MenuItem } from "@/types";
import { MenuProductCard } from "@/components/menu/MenuProductCard";
import { MenuProductSkeleton } from "@/components/menu/MenuProductSkeleton";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";

const POPULAR_KEYWORDS = [
  "Soup",
  "Salad",
  "Maggi",
  "Fries",
  "Garlic",
  "Tomato",
  "Cheese",
  "Veg",
];

interface SearchData {
  items: MenuItem[];
  categories: Array<{ _id: string; name: string }>;
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart, addItem, setQuantity, totalItems } = useApp();
  const inputRef = useRef<any>(null);

  const cartRef = useRef(cart);
  const isNavigatingRef = useRef(false);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.menu.list(),
    queryFn: () => publicGet<SearchData>("/api/menu"),
    staleTime: 5 * 60 * 1000,
  });

  const allItems = data?.items || [];
  const categories = data?.categories || [];
  const loading = isLoading;
  const error = isError ? "Failed to load menu list. Please try again." : null;

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

  // Autofocus search input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // Filter items matching the query text
  const getFilteredItems = () => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return allItems.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(query);
      const descMatch = (item.description || "").toLowerCase().includes(query);
      const categoryMatch = categories
        .find((c) => c._id === item.category)
        ?.name.toLowerCase()
        .includes(query);

      return nameMatch || descMatch || categoryMatch;
    });
  };

  // Find matching keyword suggestions (e.g. categories or dish parts)
  const getKeywordSuggestions = () => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    const suggestions: string[] = [];

    // Match categories
    categories.forEach((cat) => {
      if (cat.name.toLowerCase().includes(query) && !suggestions.includes(cat.name)) {
        suggestions.push(cat.name);
      }
    });

    // Match unique parts of dish names
    allItems.forEach((item) => {
      if (item.name.toLowerCase().includes(query)) {
        const parts = item.name.split(" ");
        parts.forEach((part) => {
          const word = part.replace(/[^a-zA-Z]/g, "");
          if (
            word.toLowerCase().startsWith(query) &&
            word.length > 2 &&
            !suggestions.includes(word) &&
            suggestions.length < 5
          ) {
            suggestions.push(word);
          }
        });
      }
    });

    return suggestions.slice(0, 5);
  };

  const filteredItems = getFilteredItems();
  const matchedKeywords = getKeywordSuggestions();

  const handleSelectKeyword = (keyword: string) => {
    setSearchQuery(keyword);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Premium Header */}
      <SafeAreaView edges={["top"]} style={styles.safeHeader}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back-outline" size={24} color={colors.ink} />
          </Pressable>

          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={18} color="#a99c94" style={styles.searchIcon} />
            <TextInput
              ref={inputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for delicious food..."
              placeholderTextColor="#a99c94"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color="#a99c94" />
              </Pressable>
            ) : null}
          </View>

          <Pressable onPress={() => router.push("/cart")} style={styles.cartBtn}>
            <Ionicons name="cart-outline" size={24} color={colors.ink} />
            {totalItems > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{totalItems}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Main Search Panel */}
      {loading ? (
        <View style={styles.skeletonList}>
          <MenuProductSkeleton />
          <MenuProductSkeleton />
          <MenuProductSkeleton />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item._id}
          renderItem={renderProductItem}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              {/* Keyword Matches / Dropdown suggestions when typing */}
              {searchQuery.trim().length > 0 && matchedKeywords.length > 0 && (
                <View style={styles.suggestionsCard}>
                  <Text style={styles.suggestionTitle}>Matching Keywords</Text>
                  {matchedKeywords.map((kw, i) => (
                    <Pressable
                      key={kw + i}
                      onPress={() => handleSelectKeyword(kw)}
                      style={styles.suggestionItem}
                    >
                      <Ionicons name="search-sharp" size={14} color={colors.orange} />
                      <Text style={styles.suggestionText}>{kw}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Empty query: Show Popular Keywords Chips */}
              {searchQuery.trim().length === 0 && (
                <View style={styles.welcomeSection}>
                  <Text style={styles.sectionTitle}>Popular Keywords</Text>
                  <View style={styles.chipsContainer}>
                    {POPULAR_KEYWORDS.map((kw) => (
                      <Pressable
                        key={kw}
                        onPress={() => handleSelectKeyword(kw)}
                        style={styles.chip}
                      >
                        <Text style={styles.chipText}>{kw}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Header Label when showing results */}
              {searchQuery.trim().length > 0 && filteredItems.length > 0 && (
                <Text style={styles.resultsCount}>
                  Showing {filteredItems.length} matching result{filteredItems.length !== 1 ? "s" : ""}
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            searchQuery.trim().length > 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="restaurant-outline" size={48} color="#a99c94" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No matching dishes found</Text>
                <Text style={styles.emptySubtitle}>
                  Try searching for keywords like "Soup", "Salad", "Maggi", or "Fries"
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#a99c94" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>Hungry? Start Searching</Text>
                <Text style={styles.emptySubtitle}>
                  Type keywords to explore our signature menus
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#faf9f6",
  },
  safeHeader: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee3da",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#faf9f6",
    borderWidth: 1,
    borderColor: "#eee3da",
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: colors.ink,
  },
  clearBtn: {
    padding: 2,
  },
  cartBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: colors.orange,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 8.5,
    fontFamily: "Poppins_700Bold",
  },
  skeletonList: {
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: colors.danger,
  },
  listContent: {
    paddingTop: 16,
  },
  headerSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  suggestionsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee3da",
    padding: 14,
    marginBottom: 16,
    shadowColor: "#e67e22",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  suggestionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12.5,
    color: "#a99c94",
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#faf9f6",
    gap: 8,
  },
  suggestionText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.ink,
  },
  welcomeSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.ink,
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eee3da",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12.5,
    color: "#756860",
  },
  resultsCount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.ink,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: colors.ink,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#a99c94",
    textAlign: "center",
    lineHeight: 18,
  },
});
