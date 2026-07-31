import React, { useEffect } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Platform, NativeModules } from "react-native";

import { HomeHeader } from "../components/home/HomeHeader";
import { ReservationSection } from "../components/home/ReservationSection";
import { LocalAssets, getWebImageUri } from "../constants/assets";
import { colors } from "../config";

const DELICIOUS_VIDEO_URI = getWebImageUri("/assets/videos/Cinematic Food Video.mp4");

function ExpoVideoComponent({ uri, style }: { uri: string; style: any }) {
  try {
    const { useVideoPlayer, VideoView } = require("expo-video");
    const player = useVideoPlayer(uri, (p: any) => {
      p.loop = true;
      p.muted = true;
      p.play();
    });
    return (
      <VideoView
        player={player}
        style={style}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
    );
  } catch (_e) {
    return null;
  }
}

function SafeVideoPlayer({ uri, style }: { uri: string; style: any }) {
  if (Platform.OS === "web") {
    return (
      <video
        src={uri}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />
    );
  }

  // Try expo-video native module first
  try {
    const expoVideo = require("expo-video");
    if (expoVideo?.useVideoPlayer) {
      return <ExpoVideoComponent uri={uri} style={style} />;
    }
  } catch (_e) {}

  // Fallback to expo-av if linked
  const hasNativeAv = Boolean(
    NativeModules.ExponentAV ||
      NativeModules.EXAV ||
      (global as any)?.ExpoModules?.ExponentAV
  );

  if (hasNativeAv) {
    try {
      const expoAv = require("expo-av");
      const ExpoAvVideo = expoAv?.Video;
      const ResizeMode = expoAv?.ResizeMode;
      if (ExpoAvVideo) {
        return (
          <ExpoAvVideo
            source={{ uri }}
            style={style}
            resizeMode={ResizeMode?.COVER ?? "cover"}
            shouldPlay
            isLooping
            isMuted
          />
        );
      }
    } catch (_e) {}
  }

  return null;
}

export default function AboutUsScreen() {
  const insets = useSafeAreaInsets();

  // Reanimated shared values matching website fadeInRight keyframe animation
  const cardOpacity = useSharedValue(0);
  const cardTranslateX = useSharedValue(80);

  useEffect(() => {
    cardOpacity.value = withTiming(1, {
      duration: 1200,
      easing: Easing.out(Easing.quad),
    });
    cardTranslateX.value = withTiming(0, {
      duration: 1200,
      easing: Easing.out(Easing.quad),
    });
  }, []);

  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateX: cardTranslateX.value }],
  }));

  return (
    <View style={styles.page}>
      <HomeHeader />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 75 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. HERO BANNER SECTION ── */}
        <ImageBackground
          source={LocalAssets.aboutHeroBg}
          style={styles.heroBg}
          resizeMode="cover"
        >
          <LinearGradient
            colors={[
              "rgba(255, 255, 255, 0)",
              "rgba(251, 212, 184, 0.3)",
              "rgba(240, 178, 131, 0.7)",
            ]}
            style={styles.heroOverlay}
          >
            <View style={styles.heroContainer}>
              <Animated.View style={[styles.whoWeAreCard, animatedCardStyle]}>
                <Text style={styles.heroTitle}>Who We Are</Text>
                <Text style={styles.heroSubtitle}>
                  The most important thing for us is to give you the comfortable
                  dining experience
                </Text>
              </Animated.View>
            </View>
          </LinearGradient>
        </ImageBackground>

        {/* ── 2. ABOUT US / STORY SECTION ── */}
        <View style={styles.storySection}>
          <View style={styles.storyContainer}>
            <View style={styles.storyImageWrapper}>
              <Image
                source={LocalAssets.ourStoryImg}
                style={styles.storyImg}
                contentFit="cover"
              />
            </View>

            <Text style={styles.sectionTitle}>About Us</Text>

            <Text style={styles.storyText}>
              Welcome to डमरू (Damru) — where pure vegetarian food meets warmth,
              quality, and timeless hospitality.{"\n\n"}
              At Damru, our vision is simple: to serve fresh, pure, and
              delicious vegetarian cuisine at affordable prices without
              compromising on quality or experience. We believe that great food
              should be accessible to everyone, served in an elegant and
              welcoming environment that makes every visit memorable.{"\n\n"}
              Every dish is prepared using carefully selected ingredients,
              authentic recipes, and uncompromising hygiene standards. Whether
              you're joining us for a family dinner, a casual outing with
              friends, or a special celebration, we strive to create an
              experience that combines exceptional taste, heartfelt service,
              and a premium ambience.{"\n\n"}
              At Damru, we don't just serve meals—we create moments where every
              guest enjoys purity, quality, comfort, and value, all under one
              roof.{"\n\n"}
              <Text style={styles.highlightText}>
                Pure Taste. Premium Experience. Honest Value
              </Text>
            </Text>
          </View>
        </View>

        {/* ── 3. TEAM SECTION: FOUNDER & EXECUTIVE CHEF ── */}
        <View style={styles.teamSection}>
          {/* Founder Member Card */}
          <View style={styles.memberRow}>
            <View style={styles.memberHeader}>
              <Text style={styles.memberRoleTitle}>Founder</Text>
              <Text style={styles.memberName}>Raja Choudhary</Text>
            </View>

            <View style={styles.memberPhotoWrapper}>
              <Image
                source={LocalAssets.abtusFlower}
                style={styles.flowerDecoRight}
                contentFit="contain"
              />
              <View style={styles.memberPhotoContainer}>
                <Image
                  source={LocalAssets.founderPhoto}
                  style={styles.memberPhoto}
                  contentFit="cover"
                />
              </View>
            </View>

            <View style={styles.memberBioBox}>
              <Text style={styles.bioParagraph}>
                Raja Chaudhary is the heart and vision behind our restaurant—a
                passionate entrepreneur who believes that food is more than just
                a meal; it is an experience that connects people, emotions, and
                memories. His journey began with a simple yet powerful idea: to
                create a space where guests can enjoy not only great food but
                also warmth, comfort, and a sense of belonging.
              </Text>
              <Text style={styles.bioParagraph}>
                With a keen eye for detail and an uncompromising commitment to
                quality, Raj has carefully shaped every element of the
                restaurant—from the thoughtfully curated menu to the inviting
                ambiance and personalized service. His philosophy is rooted in
                authenticity, ensuring that every dish reflects genuine flavors
                while embracing modern culinary trends.
              </Text>
              <Text style={styles.bioParagraph}>
                Through dedication, innovation, and a deep understanding of
                customer expectations, he has built a brand that stands for
                trust, taste, and excellence. His continuous pursuit of
                perfection inspires the entire team to deliver exceptional
                dining experiences, making every visit memorable and worth
                returning for.
              </Text>
            </View>
          </View>

          {/* Executive Chef Member Card */}
          <View style={styles.memberRow}>
            <View style={styles.memberHeader}>
              <Text style={styles.memberRoleTitle}>Executive Chef</Text>
              <Text style={styles.memberName}>Sandeep Rana</Text>
            </View>

            <View style={styles.memberPhotoWrapper}>
              <Image
                source={LocalAssets.abtusFlower}
                style={styles.flowerDecoLeft}
                contentFit="contain"
              />
              <View style={styles.memberPhotoContainer}>
                <Image
                  source={LocalAssets.chefPhoto}
                  style={styles.memberPhoto}
                  contentFit="cover"
                />
              </View>
            </View>

            <View style={styles.memberBioBox}>
              <Text style={styles.bioParagraph}>
                Chef Sandeep Rana is the creative soul of our kitchen, bringing
                passion, artistry, and years of culinary expertise to every dish
                he creates. For him, cooking is not just a profession—it is a
                form of expression where flavors, textures, and presentation
                come together to tell a story on every plate.
              </Text>
              <Text style={styles.bioParagraph}>
                With a strong foundation in traditional techniques and a flair
                for innovation, Chef Sandeep masterfully blends classic recipes
                with contemporary influences. He believes in respecting
                ingredients, using only the freshest produce, and enhancing
                their natural flavors through carefully balanced spices and
                cooking methods.
              </Text>
              <Text style={styles.bioParagraph}>
                His dedication to excellence is reflected in every detail—from
                the aroma of freshly prepared dishes to the visual appeal of
                each presentation. Constantly experimenting and evolving, he
                ensures the menu remains exciting, refined, and satisfying for
                every guest. Under his guidance, the kitchen operates with
                precision, consistency, and a shared passion for delivering
                unforgettable culinary experiences.
              </Text>
            </View>
          </View>
        </View>

        {/* ── 4. DELICIOUS BANNER SECTION WITH BACKGROUND VIDEO ── */}
        <View style={styles.deliciousSection}>
          <Image
            source={LocalAssets.deliciousBg}
            style={styles.deliciousVideoBg}
            contentFit="cover"
          />
          <SafeVideoPlayer
            uri={DELICIOUS_VIDEO_URI}
            style={styles.deliciousVideoBg}
          />
          <View style={styles.deliciousOverlay}>
            <Text style={styles.deliciousEyebrow}>Pure Taste</Text>
            <Text style={styles.deliciousTitle}>It looks delicious</Text>
            <View style={styles.deliciousDivider} />
            <Text style={styles.deliciousSubtitle}>
              Experience flavors that look as good as they taste.
            </Text>
          </View>
        </View>

        {/* ── 5. SOPHISTICATED PROCESS SECTION ── */}
        <View style={styles.processSection}>
          <Image
            source={LocalAssets.rosemary}
            style={styles.leafTopRight}
            contentFit="contain"
          />
          <Image
            source={LocalAssets.rosemary1}
            style={styles.leafBottomLeft}
            contentFit="contain"
          />

          <Text style={styles.processMainTitle}>Sophisticated Process</Text>

          {/* Step 01: Slice */}
          <View style={styles.processCard}>
            <View style={styles.processImgWrapper}>
              <Image
                source={LocalAssets.sliceImg}
                style={styles.processImg}
                contentFit="cover"
              />
            </View>
            <View style={styles.processTextCol}>
              <Text style={styles.stepTitle}>01.Slice</Text>
              <Text style={styles.stepDesc}>
                Fresh vegetables are carefully selected and precisely sliced to
                maintain their natural texture, color, and nutrients. Every cut
                is done with care to ensure consistency and enhance the
                overall presentation of the dish.
              </Text>
            </View>
          </View>

          {/* Step 02: Marinated */}
          <View style={styles.processCard}>
            <View style={styles.processImgWrapper}>
              <Image
                source={LocalAssets.marinatedImg}
                style={styles.processImg}
                contentFit="cover"
              />
            </View>
            <View style={styles.processTextCol}>
              <Text style={styles.stepTitle}>02.Marinated</Text>
              <Text style={styles.stepDesc}>
                The vegetables are gently marinated with a blend of aromatic
                herbs, spices, and house-made sauces. This step allows flavors
                to infuse deeply, creating a rich and balanced taste in every
                bite.
              </Text>
            </View>
          </View>

          {/* Step 03: Bake */}
          <View style={styles.processCard}>
            <View style={styles.processImgWrapper}>
              <Image
                source={LocalAssets.bakeImg}
                style={styles.processImg}
                contentFit="cover"
              />
            </View>
            <View style={styles.processTextCol}>
              <Text style={styles.stepTitle}>03.Bake</Text>
              <Text style={styles.stepDesc}>
                Marinated ingredients are slow-cooked or baked to perfection,
                bringing out their natural sweetness and smoky flavors while
                maintaining a soft and delicious texture.
              </Text>
            </View>
          </View>
        </View>

        {/* ── 6. TABLE RESERVATION SECTION ── */}
        <ReservationSection />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 75,
  },

  /* Hero Section */
  heroBg: {
    width: "100%",
    minHeight: 380,
    justifyContent: "flex-end",
  },
  heroOverlay: {
    width: "100%",
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heroContainer: {
    width: "100%",
    alignItems: "center",
  },
  whoWeAreCard: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 20,
    width: "100%",
    alignItems: "center",
  },
  heroTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 38,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 22,
  },

  /* Story Section */
  storySection: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
  },
  storyContainer: {
    width: "100%",
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 36,
    color: colors.orange,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  storyImageWrapper: {
    width: "100%",
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    backgroundColor: "#FAF7F2",
  },
  storyImg: {
    width: "100%",
    height: "100%",
  },
  storyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14.5,
    color: "#444444",
    lineHeight: 24,
    textAlign: "justify",
  },
  highlightText: {
    fontFamily: "Poppins_600SemiBold",
    color: colors.orange,
  },

  /* Team Section */
  teamSection: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: "#fdf8f4",
    gap: 36,
  },
  memberRow: {
    width: "100%",
  },
  memberHeader: {
    marginBottom: 16,
    alignItems: "center",
  },
  memberRoleTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: colors.orange,
    textAlign: "center",
  },
  memberName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: "#333333",
    marginTop: 4,
    textAlign: "center",
  },
  memberPhotoWrapper: {
    position: "relative",
    width: "100%",
    height: 380,
    marginBottom: 24,
    // Soft premium card shadow
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  memberPhotoContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#FAF7F2",
    zIndex: 2,
    elevation: 3, // Sit above the decoration on Android
  },
  memberPhoto: {
    width: "100%",
    height: "100%",
    zIndex: 2,
  },
  flowerDecoRight: {
    position: "absolute",
    top: -45,
    right: -35,
    width: 170,
    height: 170,
    zIndex: 1, // Beneath photo container
    elevation: 1,
    transform: [{ rotate: "15deg" }],
    opacity: 0.95,
  },
  flowerDecoLeft: {
    position: "absolute",
    bottom: -45,
    left: -35,
    width: 170,
    height: 170,
    zIndex: 1, // Beneath photo container
    elevation: 1,
    transform: [{ rotate: "-25deg" }],
    opacity: 0.95,
  },
  memberBioBox: {
    gap: 12,
  },
  bioParagraph: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#4a4a4a",
    lineHeight: 22,
    textAlign: "justify",
  },

  /* Delicious Banner Section */
  deliciousSection: {
    width: "100%",
    height: 260,
    position: "relative",
    overflow: "hidden",
  },
  deliciousVideoBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  deliciousOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(35, 45, 25, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  deliciousEyebrow: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 8,
    textAlign: "center",
  },
  deliciousTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 38,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 46,
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  deliciousDivider: {
    width: 60,
    height: 1.5,
    backgroundColor: colors.orange,
    marginVertical: 14,
    borderRadius: 1,
  },
  deliciousSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#FFFFFF",
    opacity: 0.9,
    textAlign: "center",
    lineHeight: 22,
    letterSpacing: 0.5,
    maxWidth: "85%",
  },

  /* Process Section */
  processSection: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  processMainTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: "#000000",
    textAlign: "center",
    marginBottom: 32,
  },
  leafTopRight: {
    position: "absolute",
    top: 10,
    right: -10,
    width: 120,
    height: 120,
    opacity: 0.4,
  },
  leafBottomLeft: {
    position: "absolute",
    bottom: 20,
    left: -10,
    width: 120,
    height: 120,
    opacity: 0.4,
  },
  processCard: {
    marginBottom: 32,
  },
  processImgWrapper: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#f5f5f5",
  },
  processImg: {
    width: "100%",
    height: "100%",
  },
  processTextCol: {
    gap: 8,
  },
  stepTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: "#000000",
  },
  stepDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#666666",
    lineHeight: 22,
    textAlign: "justify",
  },
});
