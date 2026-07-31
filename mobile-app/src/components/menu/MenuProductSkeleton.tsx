import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { colors } from "../../config";

const { width: SW } = Dimensions.get("window");

export function MenuProductSkeleton() {
  return (
    <View style={styles.card}>
      {/* Image Skeleton */}
      <View style={styles.imageBox} />

      {/* Body Skeleton */}
      <View style={styles.itemBody}>
        {/* Title line */}
        <View style={styles.titleLine} />
        {/* Description lines */}
        <View style={styles.descLine} />
        <View style={[styles.descLine, { width: "70%", marginTop: 5 }]} />

        {/* Footer line */}
        <View style={styles.itemFooter}>
          <View style={styles.priceLine} />
          <View style={styles.btnLine} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#ffffff",
    gap: 13,
  },
  imageBox: {
    width: 110,
    height: 110,
    borderRadius: 14,
    backgroundColor: "#f2ede8",
  },
  itemBody: {
    flex: 1,
    paddingVertical: 3,
    justifyContent: "space-between",
    height: 110,
  },
  titleLine: {
    width: "60%",
    height: 18,
    borderRadius: 4,
    backgroundColor: "#f2ede8",
    marginBottom: 8,
  },
  descLine: {
    width: "90%",
    height: 12,
    borderRadius: 3,
    backgroundColor: "#f2ede8",
  },
  itemFooter: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceLine: {
    width: "30%",
    height: 16,
    borderRadius: 4,
    backgroundColor: "#f2ede8",
  },
  btnLine: {
    width: 76,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f2ede8",
  },
});
