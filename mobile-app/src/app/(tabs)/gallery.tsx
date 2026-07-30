import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TopBar } from "@/components/TopBar";
import { EmptyState, ScreenTitle } from "@/components/ui";
import { assetUrl, colors } from "@/config";
import { get } from "@/lib/api";
import type { GalleryTab } from "@/types";

export default function GalleryScreen() {
  const [tabs, setTabs] = useState<GalleryTab[]>([]);
  const [active, setActive] = useState("all");
  const [loading, setLoading] = useState(true);
  useEffect(() => { get<{ tabs: GalleryTab[] }>("/api/gallery").then((d) => setTabs(d.tabs)).finally(() => setLoading(false)); }, []);
  const images = useMemo(() => tabs.filter((tab) => active === "all" || tab.tabKey === active).flatMap((tab) =>
    (tab.images ?? []).map((entry) => typeof entry === "string" ? entry : entry.image ?? entry.url ?? "").filter(Boolean)), [tabs, active]);
  return <View style={{ flex: 1, backgroundColor: "#fff" }}><TopBar />
    {loading ? <ActivityIndicator style={{ flex: 1 }} color={colors.orange} /> :
    <FlatList data={images} numColumns={2} keyExtractor={(item, index) => `${item}-${index}`} columnWrapperStyle={styles.row} contentContainerStyle={{ paddingBottom: 30 }}
      ListHeaderComponent={<><ScreenTitle eyebrow="Inside Damru" title="Good times, captured" subtitle="A glimpse of our food, spaces and celebrations." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {[{ tabKey: "all", label: "All" }, ...tabs].map((tab) => <Pressable key={tab.tabKey} onPress={() => setActive(tab.tabKey)} style={[styles.tab, active === tab.tabKey && styles.activeTab]}><Text style={[styles.tabText, active === tab.tabKey && styles.activeTabText]}>{tab.label}</Text></Pressable>)}
        </ScrollView></>}
      ListEmptyComponent={<EmptyState title="Gallery coming soon" message="New moments will appear here as they are added." />}
      renderItem={({ item }) => <Image source={{ uri: assetUrl("gallery", item) }} style={styles.image} />} />}
  </View>;
}
const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 20, gap: 8, paddingBottom: 18 },
  tab: { paddingHorizontal: 17, height: 40, justifyContent: "center", borderRadius: 20, backgroundColor: colors.cream },
  activeTab: { backgroundColor: colors.orange },
  tabText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  activeTabText: { color: "#fff" },
  row: { gap: 10, paddingHorizontal: 20, marginBottom: 10 },
  image: { flex: 1, aspectRatio: 0.86, borderRadius: 16, backgroundColor: colors.cream },
});
