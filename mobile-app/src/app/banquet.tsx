import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Field } from "@/components/ui";
import { colors } from "@/config";
import { get, post } from "@/lib/api";
import type { Branch } from "@/types";

export default function BanquetScreen() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", branchSlug: "", branchName: "", eventType: "", eventDate: "", guestCount: "", message: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { get<{ branches: Branch[] }>("/api/branches").then((d) => setBranches(d.branches)); }, []);
  const update = (key: keyof typeof form) => (value: string) => setForm((state) => ({ ...state, [key]: value }));
  async function submit() {
    setBusy(true);
    try {
      const branch = branches.find((item) => item.slug.toLowerCase() === form.branchSlug.trim().toLowerCase() || item.name.toLowerCase() === form.branchSlug.trim().toLowerCase());
      await post("/api/banquet-bookings", { ...form, branchSlug: branch?.slug ?? form.branchSlug, branchName: branch?.name ?? form.branchSlug, guestCount: Number(form.guestCount) });
      Alert.alert("Enquiry received", "Our events team will contact you shortly.", [{ text: "Done", onPress: () => router.back() }]);
    } catch (e) { Alert.alert("Event enquiry", e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>CELEBRATE WITH DAMRU</Text><Text style={styles.title}>Make it memorable.</Text><Text style={styles.copy}>Tell us what you’re planning and our banquet team will help shape every delicious detail.</Text>
    <View style={styles.card}><Field label="Full name" value={form.fullName} onChangeText={update("fullName")} /><Field label="Phone" value={form.phone} onChangeText={update("phone")} keyboardType="phone-pad" /><Field label="Email" value={form.email} onChangeText={update("email")} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Preferred branch" placeholder={branches.map((b) => b.name).slice(0, 2).join(" / ") || "Branch name"} value={form.branchSlug} onChangeText={update("branchSlug")} /><Field label="Event type" placeholder="Birthday, wedding, corporate…" value={form.eventType} onChangeText={update("eventType")} /><Field label="Event date" placeholder="YYYY-MM-DD" value={form.eventDate} onChangeText={update("eventDate")} /><Field label="Guest count" value={form.guestCount} onChangeText={update("guestCount")} keyboardType="number-pad" /><Field label="Tell us more" value={form.message} onChangeText={update("message")} multiline numberOfLines={4} /><Button label="Send enquiry" loading={busy} onPress={submit} /></View>
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 50 }, eyebrow: { color: colors.orange, fontSize: 12, fontWeight: "900", letterSpacing: 1.4 }, title: { color: colors.ink, fontSize: 34, fontWeight: "900", marginTop: 7 }, copy: { color: colors.muted, lineHeight: 21, marginTop: 9, marginBottom: 24 }, card: { padding: 19, borderRadius: 22, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line } });
