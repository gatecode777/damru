import { useEffect, useState } from "react";
import { AccessibilityInfo, Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const ORANGE = "#f15a16";
const IVORY = "#fffaf5";
const INK = "#35170f";

function PaisleyPattern() {
  return (
    <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 400 260" style={StyleSheet.absoluteFill}>
      <Path d="M-15 190C42 98 112 121 94 184c-13 45-78 37-58-8 12-27 48-18 39 8" fill="none" stroke="#fff" strokeWidth="1.2" />
      <Path d="M46 256c36-78 106-61 112-12 5 40-50 51-60 17-7-23 22-37 37-18" fill="none" stroke="#fff" strokeWidth="1" />
      <Path d="M415 173c-57-81-119-46-96 14 17 43 79 28 54-14-14-24-48-12-35 13" fill="none" stroke="#fff" strokeWidth="1.2" />
      <Path d="M344 269c-28-79-98-70-110-22-10 39 43 56 58 23 10-22-16-39-34-22" fill="none" stroke="#fff" strokeWidth="1" />
      <Path d="M8 225c55-39 108-27 157 20M392 221c-61-35-116-20-159 25" fill="none" stroke="#fff" strokeWidth="0.8" />
    </Svg>
  );
}

function ClochePanelTop() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 82" preserveAspectRatio="none">
      <Path d="M0 4C48 25 96 38 138 48C164 39 183 36 200 37C217 36 236 39 262 48C304 38 352 25 400 4" fill="none" stroke={ORANGE} strokeWidth="1.4" />
      <Path d="M0 9C48 30 96 43 138 53C164 44 183 41 200 42C217 41 236 44 262 53C304 43 352 30 400 9V82H0Z" fill={ORANGE} />
      <Path d="M0 9C48 30 96 43 138 53C164 44 183 41 200 42C217 41 236 44 262 53C304 43 352 30 400 9" fill="none" stroke={IVORY} strokeWidth="2.2" />
    </Svg>
  );
}

function PulseDot({ index, phase, reducedMotion }: { index: number; phase: SharedValue<number>; reducedMotion: boolean }) {
  const style = useAnimatedStyle(() => {
    if (reducedMotion) return { opacity: index === 1 ? 1 : 0.45, transform: [{ scale: 1 }] };
    const active = Math.floor(phase.value) % 3 === index;
    return { opacity: active ? 1 : 0.35, transform: [{ scale: active ? 1.25 : 1 }] };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

function CookingLoader({ reducedMotion }: { reducedMotion: boolean }) {
  const entrance = useSharedValue(reducedMotion ? 1 : 0);
  const lidY = useSharedValue(0);
  const steamOne = useSharedValue(0);
  const steamTwo = useSharedValue(0);
  const dotPhase = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    entrance.value = withDelay(500, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
    lidY.value = withDelay(800, withRepeat(withSequence(withTiming(-3, { duration: 650 }), withTiming(0, { duration: 650 })), -1, false));
    steamOne.value = withDelay(800, withRepeat(withSequence(withTiming(1, { duration: 800 }), withTiming(0, { duration: 500 })), -1, false));
    steamTwo.value = withDelay(1050, withRepeat(withSequence(withTiming(1, { duration: 800 }), withTiming(0, { duration: 500 })), -1, false));
    dotPhase.value = withDelay(800, withRepeat(withTiming(3, { duration: 1200, easing: Easing.linear }), -1, false));
    return () => [entrance, lidY, steamOne, steamTwo, dotPhase].forEach(cancelAnimation);
  }, [dotPhase, entrance, lidY, reducedMotion, steamOne, steamTwo]);

  const entranceStyle = useAnimatedStyle(() => ({ opacity: entrance.value, transform: [{ scale: 0.94 + entrance.value * 0.06 }] }));
  const lidStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lidY.value }] }));
  const steamOneStyle = useAnimatedStyle(() => ({ opacity: steamOne.value, transform: [{ translateY: -9 * steamOne.value }] }));
  const steamTwoStyle = useAnimatedStyle(() => ({ opacity: steamTwo.value, transform: [{ translateY: -9 * steamTwo.value }] }));

  return (
    <Animated.View style={[styles.loader, entranceStyle]}>
      <View style={styles.steamArea}>
        <Animated.View style={[styles.steam, styles.steamLeft, steamOneStyle]}><Svg width={15} height={36} viewBox="0 0 15 36"><Path d="M9 34C0 24 16 17 7 2" fill="none" stroke={ORANGE} strokeWidth="1.7" strokeLinecap="round" /></Svg></Animated.View>
        <Animated.View style={[styles.steam, styles.steamRight, steamTwoStyle]}><Svg width={15} height={36} viewBox="0 0 15 36"><Path d="M6 34c9-10-7-17 2-32" fill="none" stroke={ORANGE} strokeWidth="1.7" strokeLinecap="round" /></Svg></Animated.View>
      </View>
      <View style={styles.potArea}>
        <Svg width={92} height={52} viewBox="0 0 116 64"><Path d="M18 27h80l-5 28c-1 5-7 8-13 8H36c-7 0-12-3-13-8l-5-28ZM10 27h96M20 58c20 4 56 4 76 0" fill="none" stroke={ORANGE} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /></Svg>
        <Animated.View style={[styles.lid, lidStyle]}><Svg width={76} height={25} viewBox="0 0 96 31"><Path d="M9 27c3-17 18-23 39-23s36 6 39 23H9Zm-4 0h86M44 4V1h8v3" fill="none" stroke={ORANGE} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /></Svg></Animated.View>
      </View>
      <View style={styles.dots}>{[0, 1, 2].map((index) => <PulseDot key={index} index={index} phase={dotPhase} reducedMotion={reducedMotion} />)}</View>
      <Text style={styles.preparing}>PREPARING SOMETHING DELICIOUS...</Text>
    </Animated.View>
  );
}

export function BrandSplash({ fontsLoaded, exiting = false }: { fontsLoaded: boolean; exiting?: boolean }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [reducedMotion, setReducedMotion] = useState(false);
  const screenOpacity = useSharedValue(0);
  const logoReveal = useSharedValue(0);
  const panelReveal = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReducedMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => { if (mounted) setReducedMotion(enabled); });
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      screenOpacity.value = 1;
      logoReveal.value = 1;
      panelReveal.value = 1;
      return;
    }
    screenOpacity.value = withTiming(1, { duration: 300 });
    logoReveal.value = withDelay(150, withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) }));
    panelReveal.value = withDelay(350, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    return () => [screenOpacity, logoReveal, panelReveal].forEach(cancelAnimation);
  }, [logoReveal, panelReveal, reducedMotion, screenOpacity]);

  useEffect(() => {
    if (exiting) screenOpacity.value = reducedMotion ? 0 : withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) });
  }, [exiting, reducedMotion, screenOpacity]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoReveal.value, transform: [{ scale: 0.94 + logoReveal.value * 0.06 }] }));
  const panelStyle = useAnimatedStyle(() => ({ opacity: panelReveal.value, transform: [{ translateY: 20 * (1 - panelReveal.value) }] }));
  const logoWidth = Math.min(width * 0.78, width > 700 ? 620 : 360);
  const compact = height < 700;
  const verticalShift = 30;
  const panelBodyHeight = Math.max(150, height * 0.26 + insets.bottom - 30);

  return (
    <Animated.View style={[styles.stage, { paddingTop: insets.top, paddingBottom: insets.bottom }, screenStyle]}>
      <View style={[styles.upper, { paddingHorizontal: width > 700 ? 64 : 24 }]}>
        {fontsLoaded ? <Text style={[styles.eyebrow, { top: height * 0.074 + verticalShift }, compact && styles.eyebrowCompact]}>JAIPUR • EST. WITH LOVE</Text> : null}
        <Animated.View style={[styles.logoWrap, { top: height * 0.19 + verticalShift, width: logoWidth, height: logoWidth / 2.052 }, logoStyle]}>
          <Image source={require("../../../assets/images/damru-brand-logo.png")} style={styles.logo} resizeMode="contain" />
        </Animated.View>
        <View style={[styles.loaderPosition, { top: height * 0.445 + verticalShift }]}><CookingLoader reducedMotion={reducedMotion} /></View>
      </View>

      <Animated.View style={[styles.panel, { height: panelBodyHeight }, panelStyle]}>
        <View style={styles.clocheCurve}><ClochePanelTop /></View>
        <View style={styles.clocheKnob} />
        <View style={styles.pattern}><PaisleyPattern /></View>
        <View style={styles.panelCopy}>
          {fontsLoaded ? <><Text style={styles.panelTitle}>PURE VEG. GRAND MOMENTS.</Text><Text style={styles.panelSubtitle}>Restaurant • Banquets • Celebrations</Text></> : null}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: IVORY, overflow: "hidden" },
  upper: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", zIndex: 2 },
  eyebrow: { position: "absolute", fontFamily: "Poppins_500Medium", fontSize: 10, letterSpacing: 3.2, color: "#866b5e" },
  eyebrowCompact: { fontSize: 9 },
  logoWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  logo: { width: "100%", height: "100%" },
  loaderPosition: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  loader: { alignItems: "center" },
  steamArea: { width: 60, height: 38, position: "relative" },
  steam: { position: "absolute", bottom: 0 },
  steamLeft: { left: 13 },
  steamRight: { right: 13 },
  potArea: { width: 92, height: 52, position: "relative" },
  lid: { position: "absolute", top: -2, left: 8 },
  dots: { flexDirection: "row", gap: 14, marginTop: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE },
  preparing: { marginTop: 15, fontFamily: "Poppins_500Medium", fontSize: 9, letterSpacing: 1.9, color: INK },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: ORANGE, justifyContent: "center" },
  clocheCurve: { position: "absolute", top: -74, left: 0, right: 0, height: 82 },
  clocheKnob: { position: "absolute", top: -54, left: "50%", marginLeft: -10, width: 20, height: 20, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: ORANGE },
  pattern: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.085,
  },
  panelCopy: { position: "absolute", top: "39%", left: 0, right: 0, alignItems: "center", paddingHorizontal: 24 },
  panelTitle: { fontFamily: "Poppins_700Bold", fontSize: 16, letterSpacing: 0.45, color: "#fff", textAlign: "center" },
  panelSubtitle: { marginTop: 10, fontFamily: "Poppins_400Regular", fontSize: 12, letterSpacing: 0.3, color: "rgba(255,255,255,0.92)", textAlign: "center" },
});
