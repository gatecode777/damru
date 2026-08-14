import React from "react";
import { View, Text, StyleSheet, Switch, Alert, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors } from "@/config";
import { getNotificationPreferences, updateNotificationPreferences } from "@/services/notificationsApi";
import { getApiErrorMessage } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import type { NotificationPreferences } from "@/types/notifications";

const PREFERENCE_KEY = ["notifications", "preferences"] as const;

const ROWS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: "orderUpdates", label: "Order Updates", description: "Order placed, confirmed, out for delivery, delivered." },
  { key: "rewardUpdates", label: "Reward Updates", description: "Damru credits, streaks, achievements, and missions." },
  { key: "promotionalPush", label: "Promotional Push", description: "Offers and campaigns sent as app notifications." },
  { key: "promotionalEmail", label: "Promotional Emails", description: "Offers and campaigns sent to your email." },
  { key: "promotionalInApp", label: "Promotional In-App", description: "Offers shown inside the app." },
];

export default function NotificationSettingsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: PREFERENCE_KEY,
    queryFn: () => getNotificationPreferences(),
    select: (res) => res.preferences,
  });

  async function handleToggle(key: keyof NotificationPreferences, value: boolean) {
    const previous = queryClient.getQueryData<{ preferences: NotificationPreferences }>(PREFERENCE_KEY);
    queryClient.setQueryData<{ preferences: NotificationPreferences } | undefined>(PREFERENCE_KEY, (old) =>
      old ? { preferences: { ...old.preferences, [key]: value } } : old
    );
    try {
      await updateNotificationPreferences({ [key]: value });
    } catch (err) {
      if (previous) queryClient.setQueryData(PREFERENCE_KEY, previous);
      Alert.alert("Not saved", getApiErrorMessage(err, "Unable to update this preference. Please try again."));
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Notification Preferences", headerShown: true }} />

      {isLoading ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Skeleton width="90%" height={12} style={{ marginBottom: 14 }} />
          <View style={styles.card}>
            {ROWS.map((row, i) => (
              <View key={row.key} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Skeleton width="50%" height={14} style={{ marginBottom: 6 }} />
                  <Skeleton width="85%" height={12} />
                </View>
                <Skeleton width={40} height={24} radius={12} />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : error || !data ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Unable to load your preferences.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.note}>Critical account and security notifications (like password changes) are always sent regardless of these settings.</Text>
          <View style={styles.card}>
            {ROWS.map((row, i) => (
              <View key={row.key} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowDesc}>{row.description}</Text>
                </View>
                <Switch
                  value={data[row.key]}
                  onValueChange={(value) => handleToggle(row.key, value)}
                  trackColor={{ false: "#e0d5c8", true: colors.orange }}
                  thumbColor="#ffffff"
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf9f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  errorText: { fontFamily: "Poppins_500Medium", fontSize: 14, color: colors.danger, textAlign: "center" },
  content: { padding: 16, paddingBottom: 40 },
  note: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#a99c94", lineHeight: 17, marginBottom: 14 },
  card: {
    backgroundColor: "#ffffff", borderRadius: 18,
    borderWidth: 1, borderColor: "#eee3da", overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", padding: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#f3ece6" },
  rowLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: colors.ink, marginBottom: 2 },
  rowDesc: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#a99c94", lineHeight: 16 },
});
