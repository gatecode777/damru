import React, { useState } from "react";
import { Modal, View, Text, Pressable, TextInput, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/config";
import { CANCEL_REASONS } from "@/constants/orderStatus";

interface CancelOrderSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export function CancelOrderSheet({ visible, onClose, onSubmit }: CancelOrderSheetProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");

  const isOther = selected === "Other";
  const reason = isOther ? otherText.trim() : selected;
  const canSubmit = !!reason && reason.length >= 5;

  function handleClose() {
    setSelected(null);
    setOtherText("");
    onClose();
  }

  function handleSubmit() {
    if (!canSubmit || !reason) return;
    onSubmit(reason);
    setSelected(null);
    setOtherText("");
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Why are you cancelling?</Text>
          <Text style={styles.subtitle}>This helps us improve. Pick a reason below.</Text>

          <View style={styles.chipGrid}>
            {CANCEL_REASONS.map((r) => {
              const active = selected === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setSelected(r)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
                </Pressable>
              );
            })}
          </View>

          {isOther && (
            <TextInput
              style={styles.input}
              placeholder="Tell us what happened…"
              placeholderTextColor="#a99c94"
              value={otherText}
              onChangeText={setOtherText}
              multiline
              maxLength={500}
            />
          )}

          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            disabled={!canSubmit}
            onPress={handleSubmit}
          >
            <Ionicons name="close-circle-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.submitText}>Cancel Order</Text>
          </Pressable>

          <Pressable style={styles.keepBtn} onPress={handleClose}>
            <Text style={styles.keepText}>Never mind, keep my order</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e0d5c8",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 17,
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#a99c94",
    marginBottom: 16,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#faf9f6",
  },
  chipActive: {
    borderColor: colors.orange,
    backgroundColor: "rgba(229, 121, 34, 0.1)",
  },
  chipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.orangeDark,
    fontFamily: "Poppins_600SemiBold",
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    minHeight: 70,
    textAlignVertical: "top",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: colors.ink,
    marginBottom: 12,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    borderRadius: 14,
    height: 52,
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#ffffff",
  },
  keepBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  keepText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: "#756860",
  },
});
