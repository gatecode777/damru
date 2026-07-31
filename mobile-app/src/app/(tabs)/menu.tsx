import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { HomeHeader } from "@/components/home/HomeHeader";
import { EmptyState, ScreenTitle } from "@/components/ui";
import { MenuHeroSection } from "@/components/menu/MenuHeroSection";
import { assetUrl, colors } from "@/config";
import { get } from "@/lib/api";
import { useApp } from "@/providers/AppProvider";
import type { MenuItem } from "@/types";

export default function MenuScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q || "");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Search for dishes by name or ingredient.");
  const { addItem, totalItems } = useApp();

  useEffect(() => {
    if (params.q) {
      setQuery(params.q);
    }
  }, [params.q]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) { setItems([]); setMessage("Search for dishes by name or ingredient."); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await get<{ results: MenuItem[] }>(`/api/search?q=${encodeURIComponent(normalized)}`);
        setItems(data.results ?? []);
        setMessage(`No dishes found for “${normalized}”.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load the menu.");
        setItems([]);
      } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return <View style={styles.page}>
    <HomeHeader />
    <FlatList
      data={items}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<>
        <MenuHeroSection />
        <ScreenTitle eyebrow="Freshly prepared" title="Find your favourite" subtitle="Search the live Damru menu and add dishes straight to your cart." />
        <View style={styles.search}>
          <MaterialIcons name="search" color={colors.muted} size={22} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Try “momos”, “shake”, “soup”…" placeholderTextColor="#a99c94" style={styles.input} returnKeyType="search" />
          {query ? <Pressable onPress={() => setQuery("")}><MaterialIcons name="cancel" color="#a99c94" size={20} /></Pressable> : null}
        </View>
        {loading ? <ActivityIndicator color={colors.orange} style={{ marginVertical: 36 }} /> : null}
      </>}
      ListEmptyComponent={!loading ? <EmptyState title="What are you craving?" message={message} /> : null}
      renderItem={({ item }) => <View style={styles.item}>
        <View style={styles.imageBox}>
          <Image source={{ uri: assetUrl("menu-items", item.image) }} style={styles.image} resizeMode="contain" />
        </View>
        <View style={styles.itemBody}>
          {item.category ? <Text style={styles.category}>{item.category}</Text> : null}
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.description} numberOfLines={2}>{item.desc}</Text>
          <View style={styles.itemFooter}>
            <Text style={styles.price}>{item.hasVariants ? "From " : ""}₹{item.price}</Text>
            <Pressable style={styles.add} onPress={() => addItem(item)}>
              <MaterialIcons name="add" color="#fff" size={20} /><Text style={styles.addText}>ADD</Text>
            </Pressable>
          </View>
        </View>
      </View>}
    />
    {totalItems > 0 ? <Pressable style={styles.cartBar} onPress={() => router.push("/cart")}>
      <Text style={styles.cartText}>{totalItems} item{totalItems === 1 ? "" : "s"} in cart</Text>
      <Text style={styles.cartText}>View cart →</Text>
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },
  list: { paddingBottom: 100 },
  search: { marginHorizontal: 20, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.cream, borderRadius: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.line },
  input: { flex: 1, minHeight: 54, color: colors.ink, fontSize: 15 },
  item: { flexDirection: "row", alignItems: "flex-start", marginHorizontal: 20, marginBottom: 14, borderRadius: 20, padding: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff", gap: 13 },
  imageBox: { width: 110, height: 110, borderRadius: 14, overflow: "hidden", backgroundColor: colors.cream },
  image: { width: 110, height: 110 },
  itemBody: { flex: 1, paddingVertical: 3 },
  category: { color: colors.orange, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 },
  itemName: { fontSize: 17, fontWeight: "800", color: colors.ink, marginTop: 3 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  itemFooter: { marginTop: "auto", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { fontSize: 15, fontWeight: "900", color: colors.ink },
  add: { flexDirection: "row", alignItems: "center", backgroundColor: colors.orange, paddingHorizontal: 11, height: 34, borderRadius: 10 },
  addText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  cartBar: { position: "absolute", bottom: 85, left: 18, right: 18, height: 56, borderRadius: 16, backgroundColor: colors.orangeDark, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  cartText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
