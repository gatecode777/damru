import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { TopBar } from "@/components/TopBar";
import { EmptyState, ScreenTitle } from "@/components/ui";
import { assetUrl, colors } from "@/config";
import { get } from "@/lib/api";
import type { Branch } from "@/types";

export default function BranchesScreen() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { get<{ branches: Branch[] }>("/api/branches").then((d) => setBranches(d.branches)).finally(() => setLoading(false)); }, []);
  return <View style={{ flex: 1, backgroundColor: "#fff" }}><TopBar />
    {loading ? <ActivityIndicator style={{ flex: 1 }} color={colors.orange} /> :
    <FlatList data={branches} keyExtractor={(item) => item._id} contentContainerStyle={{ paddingBottom: 30 }}
      ListHeaderComponent={<ScreenTitle eyebrow="Find us" title="Our branches" subtitle="Come for the food. Stay for the unmistakable Damru vibe." />}
      ListEmptyComponent={<EmptyState title="No branches found" message="Please check your connection and try again." />}
      renderItem={({ item }) => <View style={styles.card}>
        <Image source={{ uri: assetUrl("branches", item.cardImage ?? item.heroImage) }} style={styles.image} />
        <View style={styles.body}><Text style={styles.name}>{item.name}</Text>
          <Text style={styles.address}>{item.address ?? item.city}</Text>
          {item.shortDescription ? <Text style={styles.copy} numberOfLines={2}>{item.shortDescription}</Text> : null}
          <View style={styles.actions}>
            {item.phone ? <Pressable style={styles.action} onPress={() => Linking.openURL(`tel:${item.phone}`)}><MaterialIcons name="call" size={18} color={colors.orange} /><Text style={styles.actionText}>Call</Text></Pressable> : null}
            <Pressable style={styles.action} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.address ?? item.city ?? ""}`)}`)}><MaterialIcons name="directions" size={18} color={colors.orange} /><Text style={styles.actionText}>Directions</Text></Pressable>
          </View>
        </View>
      </View>} />}
  </View>;
}
const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 18, borderRadius: 22, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line },
  image: { height: 190, width: "100%", backgroundColor: colors.cream },
  body: { padding: 18 },
  name: { fontSize: 21, fontWeight: "900", color: colors.ink },
  address: { color: colors.orangeDark, fontWeight: "700", fontSize: 13, marginTop: 5 },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 9 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  action: { flex: 1, height: 42, borderRadius: 12, flexDirection: "row", gap: 7, justifyContent: "center", alignItems: "center", backgroundColor: colors.cream },
  actionText: { color: colors.orangeDark, fontWeight: "800", fontSize: 13 },
});
