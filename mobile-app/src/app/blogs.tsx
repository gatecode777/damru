import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { EmptyState, ScreenTitle } from "@/components/ui";
import { assetUrl, colors } from "@/config";
import { get } from "@/lib/api";

type Blog = { _id: string; title: string; excerpt?: string; coverImage?: string; slug: string; publishedAt?: string; category?: { name?: string }; author?: { name?: string } };
export default function BlogsScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(() => { setLoading(true); get<{ results: Blog[] }>(`/api/blog-search?q=${encodeURIComponent(query.trim())}`).then((d) => setResults(d.results)).finally(() => setLoading(false)); }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  return <FlatList data={results} keyExtractor={(item) => item._id} contentContainerStyle={{ paddingBottom: 30 }}
    ListHeaderComponent={<><ScreenTitle eyebrow="From our kitchen" title="Food stories" subtitle="Search our journal for recipes, culture and restaurant stories." /><View style={styles.search}><MaterialIcons name="search" color={colors.muted} size={22} /><TextInput value={query} onChangeText={setQuery} placeholder="Search stories…" placeholderTextColor="#a99c94" style={styles.input} /></View>{loading ? <ActivityIndicator color={colors.orange} /> : null}</>}
    ListEmptyComponent={!loading ? <EmptyState title="Discover a story" message={query.length >= 2 ? "No matching stories found." : "Type at least two letters to search the journal."} /> : null}
    renderItem={({ item }) => <View style={styles.card}><Image source={{ uri: assetUrl("blogs", item.coverImage) }} style={styles.image} /><View style={styles.body}><Text style={styles.meta}>{item.category?.name ?? "DAMRU JOURNAL"}</Text><Text style={styles.title}>{item.title}</Text>{item.excerpt ? <Text style={styles.excerpt} numberOfLines={3}>{item.excerpt}</Text> : null}<Text style={styles.author}>{item.author?.name ? `By ${item.author.name}` : "Damru Kitchen"}</Text></View></View>} />;
}
const styles = StyleSheet.create({ search: { marginHorizontal: 20, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.cream, borderRadius: 16, paddingHorizontal: 15 }, input: { flex: 1, minHeight: 54, color: colors.ink }, card: { margin: 20, marginTop: 0, borderRadius: 20, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }, image: { height: 190, backgroundColor: colors.cream }, body: { padding: 18 }, meta: { color: colors.orange, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 5 }, excerpt: { color: colors.muted, lineHeight: 20, marginTop: 8 }, author: { color: colors.orangeDark, fontWeight: "700", fontSize: 12, marginTop: 12 } });
