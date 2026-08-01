import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { StaticAssets } from "../../constants/assets";

const { width: SW } = Dimensions.get("window");

export function MenuHeroSection() {

  return (
    <View style={styles.heroContainer}>
      {/* 1. Background Image */}
      <Image
        source={StaticAssets.soupMenuHero}
        style={styles.bgImage}
        contentFit="cover"
      />

      {/* 2. Warm Translucent Gradient Overlay */}
      <LinearGradient
        colors={[
          "rgba(255, 255, 255, 1.0)",
          "rgba(254, 236, 221, 0.75)",
          "rgba(187, 103, 35, 0.40)",
          "rgba(224, 104, 6, 0.30)",
        ]}
        locations={[0, 0.19, 0.44, 1.0]}
        style={styles.absoluteFill}
      />

      {/* 3. Hero Content */}
      <View style={styles.content}>
        <Text style={styles.heading}>Our Delicious Menu</Text>
        <Text style={styles.subtitle}>
          Explore a variety of flavors crafted with passion,{"\n"}freshness, and perfection.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    width: SW,
    height: 380,
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  bgImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  absoluteFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  content: {
    position: "relative",
    zIndex: 2,
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  heading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 38,
    lineHeight: 44,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
    textShadowColor: "rgba(0, 0, 0, 0.18)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 28,
    textShadowColor: "rgba(0, 0, 0, 0.15)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  ctaBtn: {
    backgroundColor: "#e66a0d", // Restaurant theme orange
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: "#e66a0d",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  ctaBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "600",
  },
});
