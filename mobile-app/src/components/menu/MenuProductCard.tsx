import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { colors, assetUrl } from "../../config";
import type { MenuItem } from "../../types";
import { Ionicons } from "@expo/vector-icons";

interface MenuProductCardProps {
  item: MenuItem;
  qty: number;
  onAdd: (item: MenuItem) => void;
  onIncrement: (item: MenuItem) => void;
  onDecrement: (item: MenuItem) => void;
  onOrderNow: (item: MenuItem) => void;
}

export const MenuProductCard = React.memo(function MenuProductCard({
  item,
  qty,
  onAdd,
  onIncrement,
  onDecrement,
  onOrderNow,
}: MenuProductCardProps) {
  return (
    <View style={styles.card}>
      {/* Product Image */}
      <View style={styles.imageBox}>
        {item.image ? (
          <Image
            source={{ uri: assetUrl("menu-items", item.image) + "?tr=w-160,h-160,fo-auto" }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={100}
          />
        ) : (
          <View style={[styles.image, styles.placeholderImg]} />
        )}
      </View>

      {/* Product Details */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.price}>₹{item.price}</Text>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>

        {/* Action Row */}
        <View style={styles.actionRow}>
          {qty > 0 ? (
            <View style={styles.stepper}>
              <Pressable onPress={() => onDecrement(item)} style={styles.stepBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.qtyText}>{qty}</Text>
              <Pressable onPress={() => onIncrement(item)} style={styles.stepBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => onAdd(item)} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </Pressable>
          )}

          <Pressable onPress={() => onOrderNow(item)} style={styles.orderBtn}>
            <Ionicons name="bag-outline" size={14} color="#ffffff" style={styles.bagIcon} />
            <Text style={styles.orderBtnText}>Order Now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#ffffff",
    gap: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  imageBox: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.cream,
  },
  image: {
    width: 100,
    height: 100,
  },
  placeholderImg: {
    backgroundColor: "#e0d9d3",
  },
  body: {
    flex: 1,
    height: 100,
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  name: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: colors.ink,
    flex: 1,
  },
  price: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.orange,
  },
  description: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2ede8",
    borderRadius: 8,
    height: 32,
    paddingHorizontal: 4,
  },
  stepBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: colors.ink,
  },
  qtyText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.ink,
    paddingHorizontal: 8,
  },
  addBtn: {
    backgroundColor: "#f2ede8",
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: colors.ink,
  },
  orderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.orange,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 8,
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  bagIcon: {
    marginRight: 6,
  },
  orderBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: "#ffffff",
  },
});
