import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useFocusEffect } from "expo-router";
import { TopBar } from "@/components/TopBar";
import { Button, EmptyState, ScreenTitle } from "@/components/ui";
import { colors } from "@/config";
import { get, post } from "@/lib/api";
import { useApp } from "@/providers/AppProvider";

type Order = { _id: string; orderNumber?: string; total: number; status: string; createdAt: string; items?: { name: string; qty: number }[] };

export default function ProfileScreen() {
  const { user, setUser, ready } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!user) return;
    setLoading(true);
    get<{ orders: Order[] }>("/api/orders").then((d) => setOrders(d.orders)).finally(() => setLoading(false));
  }, [user]));
  if (!ready) return <ActivityIndicator style={{ flex: 1 }} color={colors.orange} />;
  return <View style={{ flex: 1, backgroundColor: "#fff" }}><TopBar />
    {!user ? <View style={{ flex: 1 }}><ScreenTitle eyebrow="Your Damru" title="Sign in to continue" subtitle="Track orders, save addresses, reserve tables and manage your profile." />
      <View style={styles.loginCard}><Text style={styles.loginIcon}>👋</Text><Text style={styles.loginTitle}>Welcome back</Text><Text style={styles.loginCopy}>Your favourites and order history are waiting.</Text><Button label="Sign in or create account" onPress={() => router.push("/auth")} /></View></View> :
    <FlatList data={orders} keyExtractor={(item) => item._id} contentContainerStyle={{ paddingBottom: 30 }}
      ListHeaderComponent={<>
        <View style={styles.profile}><View style={styles.avatar}><Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{user.name}</Text><Text style={styles.email}>{user.email}</Text></View>
          <Pressable accessibilityLabel="Log out" onPress={async () => { await post("/api/user/logout"); setUser(null); }}><MaterialIcons name="logout" size={23} color={colors.orange} /></Pressable>
        </View>
        <View style={styles.quick}>
          <Pressable style={styles.quickItem} onPress={() => router.push("/reserve")}><MaterialIcons name="event-seat" size={22} color={colors.orange} /><Text style={styles.quickText}>Reserve</Text></Pressable>
          <Pressable style={styles.quickItem} onPress={() => router.push("/cart")}><MaterialIcons name="shopping-bag" size={22} color={colors.orange} /><Text style={styles.quickText}>Cart</Text></Pressable>
          <Pressable style={styles.quickItem} onPress={() => router.push("/blogs")}><MaterialIcons name="article" size={22} color={colors.orange} /><Text style={styles.quickText}>Stories</Text></Pressable>
        </View>
        <ScreenTitle eyebrow="Recent activity" title="Your orders" />
        {loading ? <ActivityIndicator color={colors.orange} /> : null}
      </>}
      ListEmptyComponent={!loading ? <EmptyState title="No orders yet" message="Your delicious history will appear here." /> : null}
      renderItem={({ item }) => <View style={styles.order}>
        <View style={styles.orderHead}><Text style={styles.orderNo}>#{item.orderNumber ?? item._id.slice(-6).toUpperCase()}</Text><Text style={styles.status}>{item.status}</Text></View>
        <Text style={styles.orderItems} numberOfLines={2}>{item.items?.map((entry) => `${entry.qty}× ${entry.name}`).join(", ") || "Damru order"}</Text>
        <View style={styles.orderFoot}><Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text><Text style={styles.total}>₹{item.total}</Text></View>
      </View>} />}
  </View>;
}
const styles = StyleSheet.create({
  loginCard: { margin: 20, padding: 28, gap: 11, borderRadius: 24, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line },
  loginIcon: { fontSize: 42 }, loginTitle: { fontSize: 23, fontWeight: "900", color: colors.ink }, loginCopy: { color: colors.muted, lineHeight: 21, marginBottom: 10 },
  profile: { margin: 20, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, backgroundColor: colors.cream },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 25, fontWeight: "900" }, name: { color: colors.ink, fontSize: 20, fontWeight: "900" }, email: { color: colors.muted, fontSize: 12, marginTop: 3 },
  quick: { flexDirection: "row", marginHorizontal: 20, gap: 10 },
  quickItem: { flex: 1, paddingVertical: 14, gap: 6, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 15 },
  quickText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  order: { marginHorizontal: 20, marginBottom: 12, padding: 17, borderWidth: 1, borderColor: colors.line, borderRadius: 17 },
  orderHead: { flexDirection: "row", justifyContent: "space-between" }, orderNo: { fontWeight: "900", color: colors.ink }, status: { color: colors.orangeDark, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  orderItems: { color: colors.muted, fontSize: 12, marginTop: 9 }, orderFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 }, date: { color: colors.muted, fontSize: 12 }, total: { color: colors.ink, fontWeight: "900" },
});
