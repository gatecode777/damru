import { useState } from "react";
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Button, EmptyState } from "@/components/ui";
import { assetUrl, colors } from "@/config";
import { post } from "@/lib/api";
import { useApp } from "@/providers/AppProvider";

export default function CartScreen() {
  const { cart, subtotal, setQuantity, user } = useApp();
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const tax = Math.round((subtotal - discount) * 0.05 * 100) / 100;
  const total = Math.max(0, subtotal - discount + tax);
  async function applyCoupon() {
    setBusy(true);
    try {
      const data = await post<{ valid: boolean; discount?: number; message?: string; coupon?: { code: string } }>("/api/coupons", { code, cartTotal: subtotal });
      if (!data.valid) return Alert.alert("Coupon", data.message ?? "This coupon is not valid.");
      setDiscount(data.discount ?? 0); setCoupon(data.coupon?.code ?? code.toUpperCase());
    } catch (e) { Alert.alert("Coupon", e instanceof Error ? e.message : "Could not validate coupon."); } finally { setBusy(false); }
  }
  return <View style={{ flex: 1, backgroundColor: "#fff" }}>
    <FlatList data={cart} keyExtractor={(item) => `${item.menuItemId}-${item.custom}`} contentContainerStyle={{ padding: 20, paddingBottom: 250 }}
      ListEmptyComponent={<EmptyState title="Your cart is empty" message="Add something delicious from the menu." />}
      renderItem={({ item }) => <View style={styles.item}>
        <Image source={{ uri: assetUrl("menu-items", item.image) }} style={styles.image} />
        <View style={{ flex: 1 }}><Text style={styles.name}>{item.name}</Text>{item.custom ? <Text style={styles.custom}>{item.custom}</Text> : null}<Text style={styles.price}>₹{item.price}</Text></View>
        <View style={styles.stepper}><Pressable onPress={() => setQuantity(item, item.qty - 1)}><MaterialIcons name={item.qty === 1 ? "delete-outline" : "remove"} size={19} color={colors.orangeDark} /></Pressable><Text style={styles.qty}>{item.qty}</Text><Pressable onPress={() => setQuantity(item, item.qty + 1)}><MaterialIcons name="add" size={19} color={colors.orangeDark} /></Pressable></View>
      </View>}
      ListFooterComponent={cart.length ? <View>
        <View style={styles.coupon}><TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="Coupon code" placeholderTextColor="#a99c94" style={styles.couponInput} /><Button label={coupon ? "Applied" : "Apply"} loading={busy} disabled={!code || !!coupon} onPress={applyCoupon} style={{ minHeight: 44 }} /></View>
        <View style={styles.bill}><Row label="Subtotal" value={`₹${subtotal.toFixed(2)}`} />{discount ? <Row label={`Discount (${coupon})`} value={`−₹${discount.toFixed(2)}`} green /> : null}<Row label="Taxes" value={`₹${tax.toFixed(2)}`} /><View style={styles.rule} /><Row label="Total" value={`₹${total.toFixed(2)}`} strong /></View>
      </View> : null} />
    {cart.length ? <View style={styles.bottom}><Button label={user ? `Checkout · ₹${total.toFixed(2)}` : "Sign in to checkout"} onPress={() => router.push(user ? { pathname: "/checkout", params: { coupon, discount: String(discount) } } : "/auth")} /></View> : null}
  </View>;
}
function Row({ label, value, strong, green }: { label: string; value: string; strong?: boolean; green?: boolean }) {
  return <View style={styles.row}><Text style={[styles.rowText, strong && styles.strong]}>{label}</Text><Text style={[styles.rowText, strong && styles.strong, green && { color: colors.green }]}>{value}</Text></View>;
}
const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13, padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 17 },
  image: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.cream }, name: { color: colors.ink, fontWeight: "800", fontSize: 15 }, custom: { color: colors.muted, fontSize: 11, marginTop: 2 }, price: { color: colors.orangeDark, fontWeight: "900", marginTop: 7 },
  stepper: { flexDirection: "row", height: 36, gap: 10, paddingHorizontal: 9, borderRadius: 11, alignItems: "center", backgroundColor: colors.cream }, qty: { color: colors.ink, fontWeight: "900" },
  coupon: { flexDirection: "row", gap: 10, marginTop: 14 }, couponInput: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 14, color: colors.ink },
  bill: { marginTop: 20, padding: 18, borderRadius: 18, backgroundColor: colors.cream, gap: 12 }, row: { flexDirection: "row", justifyContent: "space-between" }, rowText: { color: colors.muted, fontSize: 14 }, strong: { color: colors.ink, fontWeight: "900", fontSize: 17 }, rule: { height: 1, backgroundColor: colors.line },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: 18, borderTopWidth: 1, borderTopColor: colors.line },
});
