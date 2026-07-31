import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../config";
import { post } from "../../lib/api";

interface Props {
  branchSlug: string;
  branchName: string;
  ctaTitle?: string;
  ctaSubtitle?: string;
}

const EVENT_TYPES = [
  "Birthday Party",
  "Wedding / Pre-Wedding",
  "Corporate Event",
  "Kitty Party",
  "Social Gathering",
  "Other",
];

export default function BranchInquiryForm({
  branchSlug,
  branchName,
  ctaTitle,
  ctaSubtitle,
}: Props) {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    eventType: "",
    eventDate: "",
    guestCount: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  function updateField(key: keyof typeof form, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  async function handleFormSubmit() {
    if (!form.fullName.trim() || !form.phone.trim() || !form.email.trim()) {
      setErr("Please fill in your name, phone and email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErr("Please enter a valid email address.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) {
      setErr("Please enter a valid 10-digit phone number.");
      return;
    }

    setSubmitting(true);
    setErr("");

    try {
      const payload = {
        ...form,
        branchSlug,
        branchName,
      };

      const res = await post<{ success?: boolean; error?: string }>(
        "/api/banquet-bookings",
        payload
      );

      if (res.error) {
        setErr(res.error);
        return;
      }

      setDone(true);
    } catch {
      setErr("Failed to submit request. Please check connection.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      fullName: "",
      phone: "",
      email: "",
      eventType: "",
      eventDate: "",
      guestCount: "",
      message: "",
    });
    setDone(false);
    setErr("");
  }

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <Ionicons name="checkmark-circle" size={56} color="#16a34a" />
        <Text style={styles.doneTitle}>Request Received!</Text>
        <Text style={styles.doneText}>
          Thank you! Our event coordination team will call you shortly to confirm dates and arrangements.
        </Text>
        <Pressable style={styles.submitAnotherBtn} onPress={resetForm}>
          <Text style={styles.submitAnotherText}>Submit Another Request</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{ctaTitle || "Plan Your Special Event"}</Text>
      <Text style={styles.subtitle}>
        {ctaSubtitle || "Fill in your details and let us make your celebration truly special."}
      </Text>

      {err ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color="#b91c1c" />
          <Text style={styles.errorText}>{err}</Text>
        </View>
      ) : null}

      <View style={styles.formGroup}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          value={form.fullName}
          onChangeText={(v) => updateField("fullName", v)}
          placeholder="Enter your name"
          style={styles.input}
          placeholderTextColor="#aaa"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            value={form.phone}
            onChangeText={(v) => updateField("phone", v)}
            placeholder="10-digit number"
            keyboardType="phone-pad"
            style={styles.input}
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            value={form.email}
            onChangeText={(v) => updateField("email", v)}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            placeholderTextColor="#aaa"
          />
        </View>
      </View>

      {/* Event Type Dropdown Selector */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Event Type</Text>
        <Pressable
          style={styles.dropdownTrigger}
          onPress={() => setDropdownOpen(true)}
        >
          <Text style={[styles.dropdownValue, !form.eventType && styles.placeholderText]}>
            {form.eventType || "Select Event Type"}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#6b6560" style={styles.chevronIcon} />
        </Pressable>
      </View>

      {/* Modal Dropdown Option Sheet */}
      <Modal
        visible={dropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDropdownOpen(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Event Type</Text>
              <Pressable onPress={() => setDropdownOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {EVENT_TYPES.map((type) => {
                const isSelected = form.eventType === type;
                return (
                  <Pressable
                    key={type}
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                    onPress={() => {
                      updateField("eventType", type);
                      setDropdownOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {type}
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={18} color={colors.orange} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.row}>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Event Date</Text>
          <TextInput
            value={form.eventDate}
            onChangeText={(v) => updateField("eventDate", v)}
            placeholder="YYYY-MM-DD"
            style={styles.input}
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Guest Count</Text>
          <TextInput
            value={form.guestCount}
            onChangeText={(v) => updateField("guestCount", v)}
            placeholder="e.g. 150"
            keyboardType="number-pad"
            style={styles.input}
            placeholderTextColor="#aaa"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Special Requirements / Message</Text>
        <TextInput
          value={form.message}
          onChangeText={(v) => updateField("message", v)}
          placeholder="Tell us about your event theme, catering requirements, decoration setup, etc."
          multiline
          numberOfLines={4}
          style={[styles.input, styles.multilineInput]}
          placeholderTextColor="#aaa"
        />
      </View>

      <Pressable
        style={[styles.bookBtn, submitting && styles.bookBtnDisabled]}
        onPress={handleFormSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.bookBtnText}>Book Now</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "#faf8f5",
    paddingVertical: 36,
    paddingHorizontal: 20,
    width: "100%",
  },
  heading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: colors.ink,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13.5,
    color: "#6b6560",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12.5,
    color: "#b91c1c",
    flex: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    gap: 14,
  },
  label: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#2e2a26",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e0d8ce",
    borderRadius: 6,
    height: 48,
    paddingHorizontal: 14,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: colors.ink,
  },
  dropdownTrigger: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e0d8ce",
    borderRadius: 6,
    height: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "between",
  },
  dropdownValue: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: colors.ink,
    flex: 1,
  },
  placeholderText: {
    color: "#aaa",
  },
  chevronIcon: {
    marginLeft: "auto",
  },
  multilineInput: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  bookBtn: {
    backgroundColor: "#2d3d1e",
    borderRadius: 6,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  bookBtnDisabled: {
    backgroundColor: "#5a684f",
    opacity: 0.8,
  },
  bookBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  doneContainer: {
    backgroundColor: "#faf8f5",
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: colors.ink,
    marginTop: 16,
    marginBottom: 8,
  },
  doneText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#6b6560",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  submitAnotherBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  submitAnotherText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13.5,
    color: "#ffffff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f0ece6",
    paddingBottom: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: colors.ink,
  },
  closeBtn: {
    padding: 4,
  },
  modalList: {
    width: "100%",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#fbf9f6",
  },
  modalOptionSelected: {
    backgroundColor: "#fff7ed",
  },
  optionText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14.5,
    color: "#2e2a26",
  },
  optionTextSelected: {
    fontFamily: "Poppins_600SemiBold",
    color: colors.orange,
  },
});
