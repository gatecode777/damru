import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { colors } from "@/config";
import { patch, getApiErrorMessage } from "@/lib/api";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!current || !newPassword || !confirm) {
      Alert.alert("Fill all fields", "Please enter your current password, a new password, and confirm it.");
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert("Passwords don't match", "Your new password and confirmation must match.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Password too short", "Your new password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      await patch("/api/user/me", { action: "changePassword", currentPassword: current, newPassword });
      Alert.alert("Password updated", "Your password has been changed successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Not updated", getApiErrorMessage(err, "Unable to change your password. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Change Password", headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>Choose a strong password you don't use elsewhere.</Text>

        <PasswordInput
          placeholder="Current password"
          value={current}
          onChangeText={setCurrent}
        />
        <PasswordInput
          placeholder="New password"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <PasswordInput
          placeholder="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
        />

        <Button label={saving ? "Updating…" : "Update Password"} onPress={handleSave} loading={saving} style={{ marginTop: 8 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf9f6" },
  content: { padding: 20, paddingBottom: 40 },
  subtitle: { fontFamily: "Poppins_400Regular", fontSize: 13, color: colors.muted, marginBottom: 20, lineHeight: 19 },
});
