import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { Button, EmptyState, Field, ScreenTitle } from "@/components/ui";
import { colors } from "@/config";
import { get, post } from "@/lib/api";
import { useApp } from "@/providers/AppProvider";
import type { Address } from "@/types";

const emptyAddress: Address = { label: "Home", fullName: "", phone: "", house: "", area: "", city: "", state: "", pincode: "" };
export default function CheckoutScreen() {
  const { coupon, discount: discountParam } = useLocalSearchParams<{ coupon?: string; discount?: string }>();
  const { cart, subtotal, clearCart } = useApp();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(emptyAddress);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const discount = Number(discountParam || 0);
  const total = subtotal - discount + (subtotal - discount) * 0.05;
  useEffect(() => { get<{ addresses: Address[] }>("/api/address").then((d) => { setAddresses(d.addresses); const first = d.addresses.find((a) => a.isDefault) ?? d.addresses[0]; if (first?._id) setSelected(first._id); }); }, []);
  const update = (key: keyof Address) => (value: string) => setAddress((state) => ({ ...state, [key]: value }));
  async function saveAddress() {
    try {
      const data = await post<{ address: Address }>("/api/address", address);
      setAddresses((items) => [...items, data.address]); setSelected(data.address._id!); setEditing(false);
    } catch (e) { Alert.alert("Address", e instanceof Error ? e.message : "Could not save address."); }
  }
  async function placeOrder() {
    if (!selected) return Alert.alert("Delivery address", "Please select or add an address.");
    setBusy(true);
    try {
      const data = await post<{ order: { orderNumber?: string; _id: string } }>("/api/orders", { addressId: selected, paymentMethod: "cod", couponCode: coupon || undefined, notes });
      await clearCart();
      Alert.alert("Order confirmed", `Your order #${data.order.orderNumber ?? data.order._id.slice(-6)} has been placed.`, [{ text: "Done", onPress: () => router.replace("/(tabs)/profile") }]);
    } catch (e) { Alert.alert("Could not place order", e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); }
  }
  if (!cart.length) return <EmptyState title="Nothing to check out" message="Your cart is empty." />;
  return <ScrollView contentContainerStyle={{ paddingBottom: 75 }} keyboardShouldPersistTaps="handled">
    <ScreenTitle eyebrow="Delivery" title="Where should we bring it?" />
    <View style={styles.section}>
      {addresses.map((item) => <Pressable key={item._id} onPress={() => setSelected(item._id!)} style={[styles.address, selected === item._id && styles.selected]}>
        <MaterialIcons name={selected === item._id ? "radio-button-checked" : "radio-button-unchecked"} size={21} color={colors.orange} />
        <View style={{ flex: 1 }}><Text style={styles.addressLabel}>{item.label} · {item.fullName}</Text><Text style={styles.addressCopy}>{item.house}, {item.area}, {item.city} {item.pincode}</Text></View>
      </Pressable>)}
      <Button label={editing ? "Cancel" : "Add a new address"} variant="outline" onPress={() => setEditing(!editing)} />
      {editing ? <View style={styles.form}>
        <Field label="Label" value={address.label} onChangeText={update("label")} /><Field label="Full name" value={address.fullName} onChangeText={update("fullName")} /><Field label="Phone" value={address.phone} onChangeText={update("phone")} keyboardType="phone-pad" />
        <Field label="House / Flat" value={address.house} onChangeText={update("house")} /><Field label="Area / Landmark" value={address.area} onChangeText={update("area")} /><Field label="City" value={address.city} onChangeText={update("city")} />
        <Field label="State" value={address.state} onChangeText={update("state")} /><Field label="Pincode" value={address.pincode} onChangeText={update("pincode")} keyboardType="number-pad" maxLength={6} /><Button label="Save address" onPress={saveAddress} />
      </View> : null}
    </View>
    <ScreenTitle eyebrow="Payment" title="Pay on delivery" subtitle="Cash on delivery is currently available for mobile orders." />
    <View style={styles.section}><Field label="Order notes (optional)" value={notes} onChangeText={setNotes} multiline numberOfLines={3} placeholder="Allergies, spice preference, delivery note…" /><View style={styles.total}><Text style={styles.totalLabel}>Total payable</Text><Text style={styles.totalValue}>₹{total.toFixed(2)}</Text></View><Button label="Place order" loading={busy} onPress={placeOrder} /></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  section: { marginHorizontal: 20, gap: 12 }, address: { padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 15, flexDirection: "row", gap: 11, alignItems: "flex-start" }, selected: { borderColor: colors.orange, backgroundColor: colors.cream },
  addressLabel: { color: colors.ink, fontSize: 14, fontWeight: "800" }, addressCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }, form: { padding: 16, borderRadius: 18, backgroundColor: colors.cream },
  total: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 }, totalLabel: { color: colors.ink, fontWeight: "800", fontSize: 16 }, totalValue: { color: colors.orangeDark, fontWeight: "900", fontSize: 20 },
});
