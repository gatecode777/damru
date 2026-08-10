
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Image } from '../ui/Image';
import { useRouter } from 'expo-router';
import { LocalAssets } from '../../constants/assets';

/* ─────────────────────────────────────────
   Website CSS values — DO NOT change
────────────────────────────────────────── */
const AUTO_PLAY_MS = 3000;   // main.js: setInterval 3000ms
const FADE_DURATION_MS = 1500;   // CSS: transition: opacity 1.5s ease-in-out
const SECTION_HEIGHT = 380;    // set to 380 to prevent slides looking cut in half
const FLOATING_HALF_MS = 2500;   // @keyframes floating: 5s total → 2.5s each half
const HEADING = 'Elegant Wedding Events & Special Celebrations';
const CTA_ROUTE = '/branches';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ─────────────────────────────────────────
   Explore Now Button
────────────────────────────────────────── */
function ExploreButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.exploreBtn, animStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
    >
      <Text style={styles.exploreBtnText}>Explore Now </Text>
      <Text style={styles.exploreBtnArrow}>→</Text>
    </AnimatedPressable>
  );
}
function FloatingGlassCard({ onExplore }: { onExplore: () => void }) {
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: FLOATING_HALF_MS, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
        withTiming(0, { duration: FLOATING_HALF_MS, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
      ),
      -1,
      false,
    );
  }, []);
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <Animated.View style={[styles.heroCard, floatStyle]}>
      <Text style={styles.heroHeading}>{HEADING}</Text>
      <ExploreButton onPress={onExplore} />
    </Animated.View>
  );
}
export function BanquetShowcaseSection() {
  const router = useRouter();
  const op0 = useSharedValue(1);
  const op1 = useSharedValue(0);
  const op2 = useSharedValue(0);
  const op3 = useSharedValue(0);
  const opacities = [op0, op1, op2, op3];

  const currentRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animated styles for each slide
  const slide0Style = useAnimatedStyle(() => ({ opacity: op0.value }));
  const slide1Style = useAnimatedStyle(() => ({ opacity: op1.value }));
  const slide2Style = useAnimatedStyle(() => ({ opacity: op2.value }));
  const slide3Style = useAnimatedStyle(() => ({ opacity: op3.value }));
  const slideStyles = [slide0Style, slide1Style, slide2Style, slide3Style];

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const prev = currentRef.current;
      const next = (prev + 1) % 4;

      opacities[prev].value = withTiming(0, {
        duration: FADE_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      });
      opacities[next].value = withTiming(1, {
        duration: FADE_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      });

      currentRef.current = next;
    }, AUTO_PLAY_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <View style={styles.section}>
      {/* Background slides — stacked, crossfade */}
      {LocalAssets.banquetSlides.map((src, i) => (
        <Animated.View key={i} style={[styles.slideContainer, slideStyles[i]]}>
          <Image
            source={src}
            style={styles.slideImage}
            contentFit="cover"
          />
        </Animated.View>
      ))}

      {/* Floating glass content card */}
      <View style={styles.contentWrapper}>
        <FloatingGlassCard onExplore={() => router.push(CTA_ROUTE as any)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Explicitly styled absolute container to ensure stacking layers */
  slideContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SECTION_HEIGHT,
    zIndex: 1,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },

  /* .damru-hero-slider @media ≤768px: height 450px, margin 20px 0 */
  section: {
    width: SCREEN_WIDTH,
    height: SECTION_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* .hero-content-wrapper: z-index 2, width 90% */
  contentWrapper: {
    position: 'absolute',
    zIndex: 2,
    width: '90%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /*
   * .hero-card (mobile):
   *   background rgba(255,255,255,0.5)
   *   border 1.5px solid rgba(255,255,255,0.4)
   *   border-radius 20px
   *   padding 40px 20px
   *   box-shadow 0 15px 35px rgba(0,0,0,0.1)
   */
  heroCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.50)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.40)',
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.10,
    shadowRadius: 35,
    elevation: 8,
  },

  /*
   * .hero-card h1 (mobile ≤768px):
   *   font-family Playfair Display
   *   font-size 1.8rem ≈ 29px
   *   color #111
   *   font-weight 600
   *   margin-bottom 30px
   */
  heroHeading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    color: '#111111',
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 36,
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e66a0d',
    paddingVertical: 13,
    paddingHorizontal: 36,
    borderRadius: 5,
    shadowColor: '#e66a0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 5,
  },
  exploreBtnText: {
    color: '#ffffff',
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 17,
  },
  exploreBtnArrow: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 24,
  },
});
