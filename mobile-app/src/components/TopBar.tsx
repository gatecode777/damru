import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { colors } from "@/config";
import { useApp } from "@/providers/AppProvider";

export function TopBar() {
  const { totalItems } = useApp();
  return <View style={styles.bar}>
    <View><Text style={styles.logo}>DAMRU</Text><Text style={styles.tag}>DESI FLAVOURS</Text></View>
    <View style={styles.actions}>
      <Pressable accessibilityLabel="Reserve a table" style={styles.icon} onPress={() => router.push("/reserve")}>
        <MaterialIcons name="event-seat" size={22} color={colors.ink} />
      </Pressable>
      <Pressable accessibilityLabel={`Cart with ${totalItems} items`} style={styles.icon} onPress={() => router.push("/cart")}>
        <MaterialIcons name="shopping-bag" size={22} color={colors.ink} />
        {totalItems > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(totalItems, 99)}</Text></View> : null}
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  bar: { height: 70, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: "#fff" },
  logo: { color: colors.orange, fontSize: 22, fontWeight: "900", letterSpacing: 2 },
  tag: { color: colors.ink, fontSize: 8, fontWeight: "700", letterSpacing: 2.2, marginTop: -2 },
  actions: { flexDirection: "row", gap: 8 },
  icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream, borderRadius: 21 },
  badge: { position: "absolute", right: -2, top: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
