import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Keyboard, Alert, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { useProfile } from "@/hooks/useProfile";
import { colors } from "@/config";
import { Button, Field } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";

export default function PaymentMethodsScreen() {
  const { paymentMethods, addPaymentMethod, deletePaymentMethod } = useProfile();

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddCard = async () => {
    const cleanNum = cardNumber.replace(/\s+/g, "");
    if (cleanNum.length !== 16 || !/^\d+$/.test(cleanNum)) {
      setError("Please enter a valid 16-digit card number.");
      return;
    }

    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      setError("Please enter a valid expiry date (MM/YY).");
      return;
    }

    if (cvv.length !== 3 || !/^\d+$/.test(cvv)) {
      setError("Please enter a valid 3-digit CVV.");
      return;
    }

    setSaving(true);
    setError(null);

    // Simulate network delay
    setTimeout(async () => {
      try {
        const last4 = cleanNum.slice(-4);
        const brand = cleanNum.startsWith("4") ? "visa" : "mastercard";
        await addPaymentMethod(brand, last4);
        setCardNumber("");
        setExpiry("");
        setCvv("");
        Keyboard.dismiss();
        Alert.alert("Success", "Card added successfully!");
      } catch (err) {
        setError("Failed to add card.");
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  const handleDelete = (id: string, last4: string) => {
    Alert.alert(
      "Remove Card",
      `Are you sure you want to remove card ending in ${last4}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deletePaymentMethod(id),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Payment Methods", headerShown: true }} />

      <Text style={styles.sectionTitle}>Saved Cards</Text>

      {paymentMethods.length === 0 ? (
        <Text style={styles.emptyText}>No cards saved yet.</Text>
      ) : (
        <View style={styles.cardList}>
          {paymentMethods.map((item) => (
            <View key={item.id} style={styles.cardItem}>
              <View style={styles.cardInfo}>
                <View style={styles.chip} />
                <View style={styles.cardDetails}>
                  <Text style={styles.cardNumber}>•••• •••• •••• {item.last4}</Text>
                  <Text style={styles.cardBrand}>{item.brand.toUpperCase()}</Text>
                </View>
              </View>

              <Pressable
                onPress={() => handleDelete(item.id, item.last4)}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add New Card</Text>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Field
          label="Card Number"
          value={cardNumber}
          onChangeText={(val) => setCardNumber(val.replace(/[^\d]/g, "").slice(0, 16))}
          placeholder="1234 5678 1234 5678"
          keyboardType="number-pad"
        />

        <View style={styles.row}>
          <View style={styles.col}>
            <Field
              label="Expiry (MM/YY)"
              value={expiry}
              onChangeText={(val) => {
                const clean = val.replace(/[^\d]/g, "");
                if (clean.length >= 2) {
                  setExpiry(`${clean.slice(0, 2)}/${clean.slice(2, 4)}`);
                } else {
                  setExpiry(clean);
                }
              }}
              placeholder="12/29"
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
          <View style={styles.col}>
            <Field
              label="CVV"
              value={cvv}
              onChangeText={(val) => setCvv(val.replace(/[^\d]/g, "").slice(0, 3))}
              placeholder="123"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={3}
            />
          </View>
        </View>

        <View style={styles.btnWrapper}>
          <Button
            label={saving ? "Saving Card..." : "Save Card"}
            onPress={handleAddCard}
            disabled={saving}
          />
        </View>
      </View>
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
    gap: 20,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: colors.ink,
    marginBottom: -8,
  },
  cardList: {
    gap: 12,
  },
  cardItem: {
    backgroundColor: "#20272c",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  chip: {
    width: 36,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#3a4650",
    marginRight: 14,
  },
  cardDetails: {
    flex: 1,
  },
  cardNumber: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
    letterSpacing: 1.5,
  },
  cardBrand: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: "#a99c94",
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#a99c94",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#eee3da",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  formTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: colors.ink,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 14,
  },
  col: {
    flex: 1,
  },
  btnWrapper: {
    marginTop: 10,
  },
  errorCard: {
    backgroundColor: "#ffebee",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ef9a9a",
    marginBottom: 14,
  },
  errorText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.danger,
  },
});
