import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Field } from "@/components/ui";
import { colors } from "@/config";
import { post } from "@/lib/api";
import { useApp } from "@/providers/AppProvider";

export default function ReserveScreen() {
  const { user } = useApp();
  const [form, setForm] = useState({ date: "", time: "", persons: "2", notes: "" });
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form) => (value: string) => setForm((state) => ({ ...state, [key]: value }));
  async function submit() {
    if (!user) return router.push("/auth");
    setBusy(true);
    try {
      await post("/api/reservations", { ...form, persons: Number(form.persons) });
      Alert.alert("Reservation requested", "We’ll confirm your table shortly.", [{ text: "Done", onPress: () => router.back() }]);
    } catch (e) { Alert.alert("Reservation", e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>SAVE YOUR SEAT</Text><Text style={styles.title}>A table is waiting.</Text><Text style={styles.copy}>Enter the date as YYYY-MM-DD and your preferred time. We’ll take care of the rest.</Text>
    <View style={styles.card}><Field label="Date" placeholder="2026-08-15" value={form.date} onChangeText={update("date")} keyboardType="numbers-and-punctuation" /><Field label="Time" placeholder="19:30" value={form.time} onChangeText={update("time")} keyboardType="numbers-and-punctuation" /><Field label="Number of guests" value={form.persons} onChangeText={update("persons")} keyboardType="number-pad" /><Field label="Notes (optional)" value={form.notes} onChangeText={update("notes")} multiline numberOfLines={4} placeholder="Celebration, seating preference, allergies…" /><Button label={user ? "Request reservation" : "Sign in to reserve"} loading={busy} onPress={submit} /></View>
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 50 }, eyebrow: { color: colors.orange, fontSize: 12, fontWeight: "900", letterSpacing: 1.4 }, title: { color: colors.ink, fontSize: 34, fontWeight: "900", marginTop: 7 }, copy: { color: colors.muted, lineHeight: 21, marginTop: 9, marginBottom: 24 }, card: { padding: 19, borderRadius: 22, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line } });
