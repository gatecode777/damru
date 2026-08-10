import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { StaticAssets } from "../../constants/assets";

const { width: SW } = Dimensions.get("window");
const CARD_WIDTH = Math.round(SW * 0.90);
const GAP = 12;
const INTERVAL = CARD_WIDTH + GAP;

const CATEGORIES = [
  {
    label: "Starters",
    collection: "SIGNATURE COLLECTION",
    description: "Crafted to awaken your appetite with artisanal, handcrafted bites.",
    icon: "🍽",
    image: StaticAssets.dietPlan2,
    dishesCount: "45 Dishes",
    rating: "4.9",
    time: "15–20 mins",
    bgColors: ["#233B26", "#142516", "#0B150C"], // Luxury Forest Green theme
  },
  {
    label: "Mains",
    collection: "ROYAL ENTREES",
    description: "Hearty traditional dishes prepared fresh by our master chefs.",
    icon: "🍛",
    image: StaticAssets.mains,
    dishesCount: "60 Dishes",
    rating: "4.8",
    time: "20–25 mins",
    bgColors: ["#5A3B1B", "#3A2410", "#1F1206"], // Luxury Amber Gold theme
  },
  {
    label: "Soups",
    collection: "ARTISANAL BROTHS",
    description: "Warm, comforting bowls made from organic local ingredients.",
    icon: "🍲",
    image: StaticAssets.soups,
    dishesCount: "25 Dishes",
    rating: "4.9",
    time: "10–15 mins",
    bgColors: ["#632014", "#40130B", "#220804"], // Luxury Terracotta Red theme
  },
] as const;

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
  const router = useRouter();
  const pressedShared = useSharedValue(0);

  const inputDecimalRange = [
    (index - 1) * INTERVAL,
    index * INTERVAL,
    (index + 1) * INTERVAL,
  ];

  // Micro-interaction: Card scale lift and shadow expansion on active press
  const cardAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressedShared.value, [0, 1], [1, 1.03], Extrapolation.CLAMP);
    const shadowOpacity = interpolate(pressedShared.value, [0, 1], [0.12, 0.22], Extrapolation.CLAMP);
    const shadowRadius = interpolate(pressedShared.value, [0, 1], [20, 30], Extrapolation.CLAMP);
    return {
      transform: [{ scale }],
      shadowOpacity,
      shadowRadius,
    };
  });

  // Micro-interaction: Image translateY shift up on press + scroll zoom scale
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(pressedShared.value, [0, 1], [0, -6], Extrapolation.CLAMP);
    const scrollScale = interpolate(
      scrollX.value,
      inputDecimalRange,
      [1.08, 1.0, 1.08],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }, { scale: scrollScale }],
    };
  });

  // Micro-interaction: CTA arrow slide right on press
  const ctaArrowStyle = useAnimatedStyle(() => {
    const translateX = interpolate(pressedShared.value, [0, 1], [0, 8], Extrapolation.CLAMP);
    return {
      transform: [{ translateX }],
    };
  });

  // Micro-interaction: CTA background orange fade-in on press
  const ctaBackgroundStyle = useAnimatedStyle(() => {
    const opacity = interpolate(pressedShared.value, [0, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity,
    };
  });

  return (
    <Pressable
      onPressIn={() => { pressedShared.value = withTiming(1, { duration: 150 }); }}
      onPressOut={() => { pressedShared.value = withTiming(0, { duration: 150 }); }}
      onPress={() => router.push("/menu")}
      style={styles.cardContainer}
    >
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        {/* 1. Complete Background Image */}
        <Animated.Image
          source={category.image}
          style={[StyleSheet.absoluteFill, styles.cardImg, imageAnimatedStyle]}
          resizeMode="cover"
        />

        {/* 2. Text Area Dark Gradient Overlay (Fades left-to-right, covers only left 58%) */}
        <LinearGradient
          colors={["#1E100B", "rgba(30, 16, 11, 0.95)", "rgba(30, 16, 11, 0.7)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.textOverlay}
        />

        {/* 3. Bottom Strip Dark Gradient Overlay (Fades bottom-to-top) */}
        <LinearGradient
          colors={["transparent", "rgba(30, 16, 11, 0.75)", "#1E100B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bottomOverlay}
        />

        {/* Subtle Background Watermark Leaf */}
        <Animated.Image
          source={StaticAssets.leafA}
          style={styles.leafDecorator}
          resizeMode="contain"
        />

        {/* Floating Glass Badge (Top Right) */}
        <View style={styles.glassBadge}>
          <Text style={styles.glassBadgeText}>{category.icon}</Text>
          <Text style={styles.glassBadgeLabel}>Menu</Text>
        </View>

        {/* Top Content Row */}
        <View style={styles.cardRow}>
          {/* Left Content Column (55% width) */}
          <View style={styles.leftContent}>
            {/* Upper Collection Label */}
            <Text style={styles.collectionLabel}>{category.collection}</Text>

            {/* Serif Elegant Title */}
            <Text style={styles.categoryTitle}>{category.label}</Text>

            {/* Editorial Description */}
            <Text style={styles.categoryDescription} numberOfLines={3}>
              {category.description}
            </Text>

            {/* Luxury outlined CTA Capsule */}
            <View style={styles.ctaButton}>
              {/* Animated overlay orange background */}
              <Animated.View style={[StyleSheet.absoluteFill, styles.ctaPressedBg, ctaBackgroundStyle]} />
              <View style={styles.ctaButtonContent}>
                <Text style={styles.ctaText}>Explore Menu</Text>
                <Animated.Text style={[styles.ctaArrow, ctaArrowStyle]}>  →</Animated.Text>
              </View>
            </View>
          </View>

          {/* Right Column containing Circular Food Plate */}
          <View style={styles.rightContent} />
        </View>

        {/* Bottom Information Divider Line */}
        <View style={styles.bottomDivider} />

        {/* Bottom Information Strip */}
        <View style={styles.bottomStrip}>
          <View style={styles.stripItem}>
            <Text style={styles.stripEmoji}>🍽</Text>
            <Text style={styles.stripText}>{category.dishesCount}</Text>
          </View>
          <View style={styles.stripDot} />
          <View style={styles.stripItem}>
            <Text style={styles.stripEmoji}>⭐</Text>
            <Text style={styles.stripText}>{category.rating} Rating</Text>
          </View>
          <View style={styles.stripDot} />
          <View style={styles.stripItem}>
            <Text style={styles.stripEmoji}>⏱</Text>
            <Text style={styles.stripText}>{category.time}</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginRight: GAP,
  },
  card: {
    width: "100%",
    height: 360,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    position: "relative",
    elevation: 8,
    shadowColor: "#22130F",
    shadowOffset: { width: 0, height: 12 },
  },
  leafDecorator: {
    position: "absolute",
    bottom: 25,
    left: 15,
    width: 90,
    height: 90,
    opacity: 0.035,
    transform: [{ rotate: "35deg" }],
    tintColor: "#ffffff",
  },
  glassBadge: {
    position: "absolute",
    top: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    zIndex: 4,
  },
  glassBadgeText: {
    fontSize: 14,
    marginRight: 4,
  },
  glassBadgeLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cardRow: {
    flexDirection: "row",
    width: "100%",
    height: "80%",
  },
  leftContent: {
    width: "55%",
    height: "100%",
    paddingLeft: 24,
    paddingRight: 10,
    justifyContent: "flex-end",
    paddingBottom: 10,
    zIndex: 2,
  },
  collectionLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  categoryTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34,
    color: "#ffffff",
    marginBottom: 10,
    lineHeight: 40,
  },
  categoryDescription: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.72)",
    lineHeight: 21,
    marginBottom: 20,
  },
  ctaButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    position: "relative",
  },
  ctaPressedBg: {
    backgroundColor: "#F97316",
  },
  ctaButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  ctaText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#ffffff",
  },
  ctaArrow: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
  },
  rightContent: {
    width: "45%",
    height: "100%",
  },
  cardImg: {
    borderRadius: 32,
  },
  textOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "58%",
    borderTopLeftRadius: 32,
    borderBottomLeftRadius: 32,
    zIndex: 1,
  },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 1,
  },
  bottomDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginHorizontal: 24,
    marginTop: 8,
  },
  bottomStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
    zIndex: 2,
  },
  stripItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stripEmoji: {
    fontSize: 13,
  },
  stripText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11.5,
    color: "rgba(255, 255, 255, 0.65)",
    letterSpacing: 0.5,
  },
  stripDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
});
