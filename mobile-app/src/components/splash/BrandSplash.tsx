import { useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Ellipse, Path, Line } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

/**
 * First-impression loading screen — "Rogan Maroon" colorway.
 * Runs while fonts/session/data are loading (see _layout.tsx's startupReady
 * gate). The ring doubles as both the loading indicator and a restrained
 * mandala gesture (hairline circle + orbiting arc + compass ticks) rather
 * than a spinner bolted onto separate decoration.
 */

const GOLD = "#c9a24b";
const GOLD_HI = "#eac468";
const IVORY = "#f3e6d0";
const IVORY_DIM = "#c9af8e";
const RING_TRACK = "rgba(201,162,75,0.22)";

function AnimatedBlock({
  delay,
  style,
  children,
}: {
  delay: number;
  style?: object;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}

function Wisp({ delay, offsetX }: { delay: number; offsetX: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(withTiming(-110, { duration: 6800, easing: Easing.out(Easing.quad) }), -1, false),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.14, { duration: 900 }),
          withTiming(0.14, { duration: 3200 }),
          withTiming(0, { duration: 2700 }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: offsetX }, { translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.wisp, animStyle]} />;
}

function OrbitRing() {
  const rotation = useSharedValue(0);
  const glowOpacity = useSharedValue(0.7);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 2300, easing: Easing.linear }), -1, false);
    glowOpacity.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <View style={styles.ringWrap}>
      <Animated.View style={[styles.glow, glowStyle]} />

      <Svg width="100%" height="100%" viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Circle cx={50} cy={50} r={46} stroke={RING_TRACK} strokeWidth={1.4} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Circle
            cx={50}
            cy={50}
            r={46}
            stroke={GOLD_HI}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeDasharray="34 255"
            fill="none"
          />
        </Svg>
      </Animated.View>

      {(["n", "e", "s", "w"] as const).map((pos) => (
        <View key={pos} style={[styles.tick, styles[`tick_${pos}` as const]]} />
      ))}

      {/* Hand-drawn damru (hourglass drum) monogram — an original mark for this
          splash's refined gold-line-art language, kept separate from the app's
          bold illustrated orange icon used everywhere else in the app. */}
      <Svg width="58%" height="58%" viewBox="0 0 100 100" style={styles.mark}>
        <Ellipse cx={50} cy={17} rx={21} ry={7} stroke={GOLD} strokeWidth={2.2} fill="none" />
        <Ellipse cx={50} cy={83} rx={21} ry={7} stroke={GOLD} strokeWidth={2.2} fill="none" />
        <Path d="M29,17 C24,33 39,40 47,50 C39,60 24,67 29,83" stroke={GOLD} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <Path d="M71,17 C76,33 61,40 53,50 C61,60 76,67 71,83" stroke={GOLD} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <Line x1={41} y1={42} x2={59} y2={58} stroke={GOLD} strokeWidth={1.3} opacity={0.7} />
        <Line x1={59} y1={42} x2={41} y2={58} stroke={GOLD} strokeWidth={1.3} opacity={0.7} />
      </Svg>
    </View>
  );
}

export function BrandSplash({ fontsLoaded }: { fontsLoaded: boolean }) {
  return (
    <View style={styles.stage}>
      <LinearGradient
        colors={["#5c1b28", "#3d0f16", "#1a0509"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.frame} pointerEvents="none">
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>

      <View style={styles.steamHost} pointerEvents="none">
        <Wisp delay={0} offsetX={0} />
        <Wisp delay={2200} offsetX={-16} />
        <Wisp delay={4400} offsetX={12} />
      </View>

      <View style={styles.content}>
        <AnimatedBlock delay={150}>
          <OrbitRing />
        </AnimatedBlock>

        {fontsLoaded && (
          <>
            <AnimatedBlock delay={380}>
              <Text style={styles.wordmark}>DAMRU</Text>
            </AnimatedBlock>
            <AnimatedBlock delay={580} style={styles.sublineRow}>
              <View style={styles.rule} />
              <Text style={styles.subline}>by Namo</Text>
              <View style={styles.rule} />
            </AnimatedBlock>
            <AnimatedBlock delay={780}>
              <Text style={styles.tagline}>Jaipur · Pure Veg · Banquets &amp; Celebrations</Text>
            </AnimatedBlock>
          </>
        )}
      </View>

      {fontsLoaded && (
        <AnimatedBlock delay={950} style={styles.statusRow}>
          <Text style={styles.status}>Preparing your table</Text>
        </AnimatedBlock>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3d0f16",
  },
  frame: {
    position: "absolute",
    top: "6%",
    left: "7%",
    right: "7%",
    bottom: "6%",
  },
  corner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: GOLD,
    opacity: 0.5,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1 },

  steamHost: {
    position: "absolute",
    top: "30%",
    left: "50%",
    width: 1,
    height: 1,
  },
  wisp: {
    position: "absolute",
    left: -22,
    top: -40,
    width: 44,
    height: 80,
    borderRadius: 40,
    backgroundColor: IVORY,
    opacity: 0,
  },

  content: {
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 32,
  },

  ringWrap: {
    width: 116,
    height: 116,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(234,196,104,0.16)",
  },
  mark: { position: "absolute" },
  tick: {
    position: "absolute",
    width: 5,
    height: 5,
    backgroundColor: GOLD,
    opacity: 0.6,
    transform: [{ rotate: "45deg" }],
  },
  tick_n: { top: -2, alignSelf: "center" },
  tick_s: { bottom: -2, alignSelf: "center" },
  tick_e: { right: -2, top: "50%", marginTop: -2.5 },
  tick_w: { left: -2, top: "50%", marginTop: -2.5 },

  wordmark: {
    fontFamily: "PlayfairDisplay_800ExtraBold",
    fontSize: 44,
    letterSpacing: 2,
    color: IVORY,
    textAlign: "center",
  },
  sublineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  rule: { width: 26, height: 1, backgroundColor: GOLD, opacity: 0.55 },
  subline: {
    fontFamily: "PlayfairDisplay_500Medium_Italic",
    fontStyle: "italic",
    fontSize: 20,
    color: GOLD_HI,
  },
  tagline: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: IVORY_DIM,
    textAlign: "center",
  },

  statusRow: {
    position: "absolute",
    bottom: "9%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  status: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: IVORY_DIM,
    opacity: 0.85,
  },
});
