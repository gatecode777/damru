import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/config";
import { ORDER_STEPS, DINE_IN_ORDER_STEPS } from "@/constants/orderStatus";

interface OrderStepperProps {
  status: string;
  isDineIn: boolean;
}

export function OrderStepper({ status, isDineIn }: OrderStepperProps) {
  if (status === "cancelled") {
    return (
      <View style={styles.cancelledBanner}>
        <Ionicons name="close-circle" size={20} color={colors.danger} />
        <Text style={styles.cancelledText}>This order was cancelled</Text>
      </View>
    );
  }

  const steps = isDineIn ? DINE_IN_ORDER_STEPS : ORDER_STEPS;
  const currentIndex = steps.findIndex((s) => s.key === status);

  return (
    <View style={styles.row}>
      {steps.map((step, i) => {
        const isDone = currentIndex > i;
        const isCurrent = currentIndex === i;
        const isActive = isDone || isCurrent;
        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepCol}>
              <View style={[styles.iconCircle, isActive && styles.iconCircleActive, isCurrent && styles.iconCircleCurrent]}>
                <Ionicons
                  name={isDone ? "checkmark" : step.icon}
                  size={16}
                  color={isActive ? "#ffffff" : "#c9bcae"}
                />
              </View>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]} numberOfLines={2}>
                {step.label}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.connector, isDone && styles.connectorActive]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepCol: {
    alignItems: "center",
    width: 56,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1e9df",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleActive: {
    backgroundColor: colors.orange,
  },
  iconCircleCurrent: {
    backgroundColor: colors.orangeDark,
  },
  stepLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: "#a99c94",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 13,
  },
  stepLabelActive: {
    color: colors.ink,
    fontFamily: "Poppins_600SemiBold",
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: "#f1e9df",
    marginTop: 15,
    marginHorizontal: -4,
  },
  connectorActive: {
    backgroundColor: colors.orange,
  },
  cancelledBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 14,
  },
  cancelledText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.danger,
  },
});
