import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../config";
import { getWebImageUri } from "../../constants/assets";
import type { IHallCard } from "../../types";

interface Props {
  hall: IHallCard;
  index: number;
}

export default function BranchHallCard({ hall, index }: Props) {
  const isAlt = index % 2 !== 0;
  const cardBg = isAlt ? "#faf8f5" : "#ffffff";

  // Resolve image URIs
  const imageBack = hall.images && hall.images[0]
    ? { uri: getWebImageUri(`/uploads/branches/${hall.images[0]}`) }
    : null;
  const imageFront = hall.images && hall.images[1]
    ? { uri: getWebImageUri(`/uploads/branches/${hall.images[1]}`) }
    : null;

  return (
    <View style={[styles.section, { backgroundColor: cardBg }]}>
      <View style={styles.container}>
        <Text style={styles.title}>{hall.title}</Text>
        {hall.subtitle ? <Text style={styles.subtitle}>{hall.subtitle}</Text> : null}
        
        {/* Overlapping Images Frame */}
        {imageBack ? (
          <View style={styles.imageOverlapContainer}>
            <Image
              source={imageBack}
              style={styles.imgBack}
              contentFit="cover"
            />
            {imageFront ? (
              <Image
                source={imageFront}
                style={styles.imgFront}
                contentFit="cover"
              />
            ) : null}
          </View>
        ) : null}

        {hall.description ? <Text style={styles.description}>{hall.description}</Text> : null}

        {/* Features list */}
        {hall.features && hall.features.length > 0 ? (
          <View style={styles.listSection}>
            <Text style={styles.listHeading}>Features & Facilities</Text>
            {hall.features.map((feature: string, idx: number) => (
              <View key={idx} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.orange} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>{feature}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Perfect For list */}
        {hall.perfectFor && hall.perfectFor.length > 0 ? (
          <View style={styles.listSection}>
            <Text style={styles.listHeading}>Perfect For</Text>
            {hall.perfectFor.map((pf: string, idx: number) => (
              <View key={idx} style={styles.bulletRow}>
                <Ionicons name="star-outline" size={15} color="#c8a96e" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>{pf}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    width: "100%",
  },
  container: {
    width: "100%",
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: colors.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: colors.orange,
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  imageOverlapContainer: {
    width: "100%",
    height: 250,
    position: "relative",
    marginVertical: 20,
  },
  imgBack: {
    width: "75%",
    height: "85%",
    borderRadius: 8,
    backgroundColor: "#faf8f5",
    position: "absolute",
    bottom: 0,
    left: 0,
  },
  imgFront: {
    width: "55%",
    height: "70%",
    borderRadius: 8,
    borderWidth: 3,
    borderColor: "#ffffff",
    backgroundColor: "#faf8f5",
    position: "absolute",
    top: 0,
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  description: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#6b6560",
    lineHeight: 22,
    marginBottom: 20,
    textAlign: "justify",
  },
  listSection: {
    marginBottom: 20,
  },
  listHeading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: colors.ink,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0ece6",
    paddingBottom: 6,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingRight: 10,
  },
  bulletIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  bulletText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13.5,
    color: "#2e2a26",
    flex: 1,
    lineHeight: 20,
  },
});
