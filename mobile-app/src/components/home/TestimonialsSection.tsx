import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

const TESTIMONIALS = [
  {
    text: "One of the best dining experiences I've had recently. The food quality is top-notch, and the taste is consistent in every bite. The service is fast, and the team ensures you feel comfortable throughout your visit. I will definitely visit again!",
    name: "Deepika Bhardwaj",
    role: "Lawyer",
    img: "https://i.pravatar.cc/150?img=32"
  },
  {
    text: "Damru Restaurant has truly raised the bar for dining in Jaipur. The ambiance is warm, the staff is welcoming, and every dish we ordered was absolutely delicious. A must-visit for food lovers!",
    name: "Priya Sharma",
    role: "Food Blogger",
    img: "https://i.pravatar.cc/150?img=47"
  },
  {
    text: "We booked the banquet hall for our family function and it was a fantastic experience. The team was professional, the food was outstanding, and our guests couldn't stop complimenting the arrangements!",
    name: "Rahul Mehta",
    role: "Business Owner",
    img: "https://i.pravatar.cc/150?img=11"
  }
];

export function TestimonialsSection() {
  const [index, setIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);

  const opacity = useSharedValue(1);
  const autoPlayTimer = useRef<any>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const transitionTo = (nextIdx: number) => {
    // 1. Fade Out content
    opacity.value = withTiming(0, { duration: 250 }, () => {
      // 2. Set new index once fully faded out
      const normalized = (nextIdx + TESTIMONIALS.length) % TESTIMONIALS.length;
      // Use React's state inside JS main thread scheduler safely
      // (Reanimated worklet calls must be scheduled on the JS thread)
      runOnJS(updateSlideIndex)(normalized);
    });
  };

  const updateSlideIndex = (next: number) => {
    setIndex(next);
    setDisplayIndex(next);
    // 3. Fade In content
    opacity.value = withTiming(1, { duration: 350 });
  };


  const handleNext = () => {
    resetAutoPlay();
    transitionTo(index + 1);
  };

  const handlePrev = () => {
    resetAutoPlay();
    transitionTo(index - 1);
  };

  const startAutoPlay = () => {
    autoPlayTimer.current = setInterval(() => {
      transitionTo(index + 1);
    }, 5000);
  };

  const resetAutoPlay = () => {
    if (autoPlayTimer.current) {
      clearInterval(autoPlayTimer.current);
    }
    startAutoPlay();
  };

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
    };
  }, [index]);

  const active = TESTIMONIALS[displayIndex];

  return (
    <View style={styles.section}>
      {/* Heading */}
      <Text style={styles.heading}>What our client say's</Text>

      {/* Slide Container */}
      <View style={styles.testiContainer}>
        {/* Animated review content */}
        <Animated.View style={[styles.contentWrapper, animatedStyle]}>
          <Text style={styles.reviewText}>{active.text}</Text>

          {/* Client profile block */}
          <View style={styles.userBlock}>
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: active.img }}
                style={styles.avatarImg}
                contentFit="cover"
              />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{active.name}</Text>
              <Text style={styles.userRole}>{active.role}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Large stylized quote indicator overlay */}
        <Text style={styles.quoteMark} pointerEvents="none">
          “
        </Text>

        {/* Slider Controls Navigation bar */}
        <View style={styles.controlsRow}>
          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            onPress={handlePrev}
          >
            <Text style={styles.arrowText}>←</Text>
          </Pressable>

          <Text style={styles.counterText}>
            {displayIndex + 1} <Text style={styles.counterDivider}>/</Text> {TESTIMONIALS.length}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            onPress={handleNext}
          >
            <Text style={styles.arrowText}>→</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    backgroundColor: "#fff9f4",
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  heading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 36,
    lineHeight: 42,
    color: "#111111",
    textAlign: "left",
    marginBottom: 40,
  },
  testiContainer: {
    width: "100%",
    position: "relative",
  },
  contentWrapper: {
    width: "100%",
    zIndex: 2,
  },
  reviewText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 18,
    lineHeight: 28,
    color: "#111111",
    textAlign: "left",
    marginBottom: 40,
    minHeight: 160, // Fixed height to stabilize avatar positioning across varying text lengths
  },
  userBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 30,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    backgroundColor: "#e5d9cf",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  avatarImg: {
    width: 80,
    height: 80,
  },
  userDetails: {
    flex: 1,
    justifyContent: "center",
  },
  userName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: "#111111",
    lineHeight: 26,
  },
  userRole: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#666666",
    marginTop: 4,
  },
  quoteMark: {
    position: "absolute",
    right: -10,
    bottom: -10,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 220,
    lineHeight: 220,
    color: "#e9f1e6",
    zIndex: 1,
    opacity: 0.85,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 10,
    zIndex: 3,
  },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  navBtnPressed: {
    transform: [{ scale: 0.9 }],
  },
  arrowText: {
    fontSize: 32,
    lineHeight: 32,
    color: "#2d3e10", // Accent green color from style.css testi-nav button
    fontWeight: "300",
  },
  counterText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: "#111111",
  },
  counterDivider: {
    color: "#bbbbbb",
    fontWeight: "300",
  },
});
