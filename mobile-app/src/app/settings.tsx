import React from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/config";

const ROWS = [
  { key: "password", icon: "lock-closed-outline" as const, label: "Change Password", route: "/change-password" as const, danger: false },
  { key: "notifications", icon: "notifications-outline" as const, label: "Notification Preferences", route: "/notification-settings" as const, danger: false },
];

export default function SettingsScreen() {
  const router = useRouter();

  function handleDeleteAccount() {
    Alert.alert(
      "Delete account",
      "Are you sure? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => Alert.alert("Account deletion unavailable", "Please contact support to request account deletion."),
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Settings", headerShown: true }} />

      <View style={styles.card}>
        {ROWS.map((row, i) => (
          <Pressable
            key={row.key}
            style={[styles.row, i > 0 && styles.rowBorder]}
            onPress={() => router.push(row.route)}
          >
            <Ionicons name={row.icon} size={20} color={colors.orange} style={{ marginRight: 14 }} />
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#c9bcae" />
          </Pressable>
        ))}
      </View>

      <View style={[styles.card, styles.dangerCard]}>
        <Pressable style={styles.row} onPress={handleDeleteAccount}>
          <Ionicons name="person-remove-outline" size={20} color={colors.danger} style={{ marginRight: 14 }} />
          <Text style={[styles.rowLabel, styles.dangerLabel]}>Delete Account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf9f6", padding: 16 },
  card: {
    backgroundColor: "#ffffff", borderRadius: 18,
    borderWidth: 1, borderColor: "#eee3da", overflow: "hidden", marginBottom: 16,
  },
  dangerCard: { borderColor: "#fecaca" },
  row: { flexDirection: "row", alignItems: "center", padding: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#f3ece6" },
  rowLabel: { flex: 1, fontFamily: "Poppins_600SemiBold", fontSize: 14, color: colors.ink },
  dangerLabel: { color: colors.danger },
});
