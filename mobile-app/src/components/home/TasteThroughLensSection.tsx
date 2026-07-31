import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

import { StaticAssets } from "../../constants/assets";

const { width: SW } = Dimensions.get("window");
const CARD_WIDTH = SW - 60;
const GAP = 16;
const INTERVAL = CARD_WIDTH + GAP;

const CATEGORIES = [
  {
    label: "Starters",
    image: StaticAssets.dietPlan2,
  },
  {
    label: "Mains",
    image: StaticAssets.mains,
  },
  {
    label: "Soups",
    image: StaticAssets.soups,
  },
];

export function TasteThroughLensSection() {
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  return (
    <View style={styles.section}>
      {/* ── Section Header ── */}
      <View style={styles.header}>
        <Text style={styles.heading}>
          Taste Through{"\n"}The Lens
        </Text>
        <Text style={styles.subtitle}>
          Explore the flavors, colors, and creativity behind every dish we serve.
        </Text>
      </View>

      {/* ── Dynamic Horizontal Carousel ── */}
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={INTERVAL}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContainer}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {CATEGORIES.map((cat, index) => (
          <LensCard
            key={cat.label}
            category={cat}
            index={index}
            scrollX={scrollX}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

interface LensCardProps {
  category: typeof CATEGORIES[number];
  index: number;
  scrollX: any;
}

function LensCard({ category, index, scrollX }: LensCardProps) {
  const inputDecimalRange = [
    (index - 1) * INTERVAL,
    index * INTERVAL,
    (index + 1) * INTERVAL,
  ];

  // Hardware-accelerated UI thread interpolations
  const animatedImgStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      inputDecimalRange,
      [1.12, 1.0, 1.12],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
    };
  });

  const animatedBlurStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      inputDecimalRange,
      [1.0, 0.0, 1.0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
    };
  });

  const animatedVignetteStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      inputDecimalRange,
      [0.6, 0.25, 0.6],
      Extrapolation.CLAMP
    );
    return {
      opacity,
    };
  });

  const animatedTitleStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      inputDecimalRange,
      [0, 10, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={styles.cardContainer}>
      <View style={styles.card}>
        {/* 1. Base Clear Image Layer */}
        <Animated.Image
          source={category.image}
          style={[styles.cardImg, animatedImgStyle]}
          resizeMode="cover"
        />

        {/* 2. Top Blurred Image Layer (Fades out when centered in the scroll window) */}
        <Animated.Image
          source={category.image}
          style={[
            styles.cardImg,
            animatedImgStyle,
            styles.absoluteFill,
            animatedBlurStyle,
          ]}
          resizeMode="cover"
          blurRadius={25}
        />

        {/* 3. Vignette Gradient Overlay */}
        <Animated.View
          style={[styles.vignette, animatedVignetteStyle]}
        />

        {/* 4. Title Layer */}
        <View style={styles.cardContent}>
          <Animated.Text style={[styles.cardTitle, animatedTitleStyle]}>
            {category.label}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: 50,
    backgroundColor: "#ffffff",
    width: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 35,
    paddingHorizontal: 16,
  },
  heading: {
    fontFamily: "PlayfairDisplay_800ExtraBold",
    fontSize: 38,
    lineHeight: 42,
    color: "#222222",
    textAlign: "center",
    marginBottom: 16,
    textShadowColor: "rgba(0, 0, 0, 0.15)",
    textShadowOffset: { width: 0, height: 10 },
    textShadowRadius: 8,
    transform: [{ perspective: 1000 }, { rotateX: "25deg" }],
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  scrollContainer: {
    paddingHorizontal: 30, // Centers card 0 at offset 0
    paddingBottom: 20,
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginRight: GAP,
  },
  card: {
    width: "100%",
    height: 350,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000000",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  cardImg: {
    width: "100%",
    height: "100%",
  },
  absoluteFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  vignette: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(187, 76, 30, 0.6)",
    zIndex: 2,
  },
  cardContent: {
    position: "absolute",
    top: 30,
    left: 0,
    width: "100%",
    paddingHorizontal: 30,
    zIndex: 3,
  },
  cardTitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 32,
    color: "#ffffff",
    fontWeight: "500",
  },
});
