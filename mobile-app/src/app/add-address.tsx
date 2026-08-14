import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, ScrollView, Switch, Pressable } from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { get, post, patch } from "@/lib/api";
import { colors } from "@/config";
import { Button, Field } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";

function AddressFormSkeleton() {
  const fieldLabels = ["Receiver Name *", "Receiver Phone Number *", "Flat / House No / Building *", "Area / Street / Sector"];
  return (
    <>
      <Text style={styles.sectionLabel}>Address Type</Text>
      <View style={styles.labelTabs}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={44} radius={10} />
        ))}
      </View>
      {fieldLabels.map((label) => (
        <View key={label} style={{ gap: 6, marginBottom: 14 }}>
          <Text style={styles.sectionLabel}>{label}</Text>
          <Skeleton height={50} radius={13} />
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.col}>
          <View style={{ gap: 6 }}>
            <Text style={styles.sectionLabel}>City *</Text>
            <Skeleton height={50} radius={13} />
          </View>
        </View>
        <View style={styles.col}>
          <View style={{ gap: 6 }}>
            <Text style={styles.sectionLabel}>State *</Text>
            <Skeleton height={50} radius={13} />
          </View>
        </View>
      </View>
    </>
  );
}

export default function AddAddressScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [label, setLabel] = useState("Home");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [house, setHouse] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (id) {
      // Fetch addresses to find the matching one
      const cached = queryClient.getQueryData<{ addresses: any[] }>(queryKeys.profile.addresses());
      const addr = cached?.addresses?.find((a) => a._id === id);
      if (addr) {
        setLabel(addr.label || "Home");
        setFullName(addr.fullName || "");
        setPhone(addr.phone || "");
        setHouse(addr.house || "");
        setArea(addr.area || "");
        setCity(addr.city || "");
        setState(addr.state || "");
        setPincode(addr.pincode || "");
        setIsDefault(!!addr.isDefault);
        setLoading(false);
      } else {
        setLoading(true);
        get<{ addresses: any[] }>("/api/address")
          .then((res) => {
            const addr = res.addresses?.find((a) => a._id === id);
            if (addr) {
              setLabel(addr.label || "Home");
              setFullName(addr.fullName || "");
              setPhone(addr.phone || "");
              setHouse(addr.house || "");
              setArea(addr.area || "");
              setCity(addr.city || "");
              setState(addr.state || "");
              setPincode(addr.pincode || "");
              setIsDefault(!!addr.isDefault);
            }
          })
          .catch((err) => {
            console.error("Failed to load address for edit:", err);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, [id, queryClient]);

  const handleSave = async () => {
    if (!fullName.trim() || !phone.trim() || !house.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setError("Please fill all required fields.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setError("Please enter a valid 6-digit pincode.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      label,
      fullName: fullName.trim(),
      phone: phone.trim(),
      house: house.trim(),
      area: area.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      isDefault,
    };

    try {
      if (id) {
        await patch("/api/address", { id, ...payload });
      } else {
        await post("/api/address", payload);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses() });
      router.back();
    } catch (err: any) {
      setError(err?.message || "Failed to save address. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: id ? "Edit Address" : "Add Address", headerShown: true }} />

      {loading ? (
        <AddressFormSkeleton />
      ) : (
        <>
          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Label selector */}
          <Text style={styles.sectionLabel}>Address Type</Text>
          <View style={styles.labelTabs}>
            {["Home", "Office", "Other"].map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setLabel(tab)}
                style={[styles.labelTab, label === tab && styles.labelTabActive]}
              >
                <Text style={[styles.labelTabText, label === tab && styles.labelTabTextActive]}>
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field
            label="Receiver Name *"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter name"
            autoCapitalize="words"
          />

          <Field
            label="Receiver Phone Number *"
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit number"
            keyboardType="phone-pad"
          />

          <Field
            label="Flat / House No / Building *"
            value={house}
            onChangeText={setHouse}
            placeholder="Enter house no, building name"
          />

          <Field
            label="Area / Street / Sector"
            value={area}
            onChangeText={setArea}
            placeholder="Enter street details"
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Field
                label="City *"
                value={city}
                onChangeText={setCity}
                placeholder="City"
              />
            </View>
            <View style={styles.col}>
              <Field
                label="State *"
                value={state}
                onChangeText={setState}
                placeholder="State"
              />
            </View>
          </View>

          <Field
            label="Pincode *"
            value={pincode}
            onChangeText={setPincode}
            placeholder="6-digit pincode"
            keyboardType="number-pad"
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.switchTitle}>Set as Default Address</Text>
              <Text style={styles.switchDesc}>Use this address as my primary shipping location.</Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ false: "#e0e0e0", true: colors.orange }}
              thumbColor={isDefault ? "#ffffff" : "#f4f3f4"}
            />
          </View>

          <View style={styles.btnWrapper}>
            <Button
              label={saving ? "Saving..." : id ? "Save Address" : "Add Address"}
              onPress={handleSave}
              disabled={saving}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf9f6",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  sectionLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.ink,
    marginBottom: -8,
  },
  labelTabs: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  labelTab: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eee3da",
    alignItems: "center",
    justifyContent: "center",
  },
  labelTabActive: {
    backgroundColor: "rgba(229, 121, 34, 0.1)",
    borderColor: colors.orange,
  },
  labelTabText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: "#756860",
  },
  labelTabTextActive: {
    color: colors.orange,
    fontFamily: "Poppins_600SemiBold",
  },
  row: {
    flexDirection: "row",
    gap: 14,
  },
  col: {
    flex: 1,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee3da",
  },
  switchTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.ink,
  },
  switchDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: "#a99c94",
    marginTop: 2,
  },
  btnWrapper: {
    marginTop: 10,
    paddingBottom: 20,
  },
  errorCard: {
    backgroundColor: "#ffebee",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ef9a9a",
  },
  errorText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.danger,
  },
});
