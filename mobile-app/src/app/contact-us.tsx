import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Dimensions,
  ImageBackground,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "../components/ui/Image";
import { HomeHeader } from "../components/home/HomeHeader";
import { ReservationSection } from "../components/home/ReservationSection";
import { LocalAssets } from "../constants/assets";
import { colors } from "../config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PHONE_NUMBER = "+91-8690987272";
const EMAIL_PRIMARY = "thedamru72@gmail.com";
const EMAIL_SECONDARY = "info@damrurestro.com";
const MAPS_URL = "https://maps.app.goo.gl/tt59VvyxGfycJEMk8";
const ADDRESS_TEXT =
  "We are located in Vinayak sarovar, Plot No. A-96, Patrakar Colony Rd, Sheer Sagar Patarkar Colony, Choraha, Mansarovar, Jaipur, Rajasthan 302020";

export default function ContactUsScreen() {
  const insets = useSafeAreaInsets();

  const handleCall = () => {
    Linking.openURL(`tel:${PHONE_NUMBER.replace(/[^0-9+]/g, "")}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleOpenMaps = () => {
    Linking.openURL(MAPS_URL);
  };

  return (
    <View style={styles.container}>
      <HomeHeader />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 65 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. HERO & OPEN TIME SECTION WITH WEBSITE BACKGROUND ── */}
        <ImageBackground
          source={LocalAssets.contactHeroBg}
          style={styles.heroBg}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay}>
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>Get in Touch</Text>
              <Text style={styles.heroSubtitle}>
                The freshest ingredients for you every day
              </Text>

              {/* Open Time Card */}
              <View style={styles.openTimeCard}>
                <Text style={styles.openTimeHeading}>Open Time</Text>
                <Text style={styles.openTimeDays}>Sunday - Saturday</Text>

                <View style={styles.dottedDividerRow}>
                  {Array.from({ length: 18 }).map((_, i) => (
                    <View key={i} style={styles.dot} />
                  ))}
                </View>

                <View style={styles.timeGrid}>
                  <View style={styles.timeSlot}>
                    <Text style={styles.timeLabel}>Brunch</Text>
                    <Text style={styles.timeValue}>11:00 - 13:00</Text>
                  </View>

                  <View style={styles.timeSlot}>
                    <Text style={styles.timeLabel}>Lunch</Text>
                    <Text style={styles.timeValue}>13:00 - 18:00</Text>
                  </View>

                  <View style={styles.timeSlot}>
                    <Text style={styles.timeLabel}>Dinner</Text>
                    <Text style={styles.timeValue}>18:00 - 20:00</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ImageBackground>

        {/* ── 2. INFO SECTION ── */}
        <View style={styles.infoSection}>
          {/* Item 1: Email & Phone Paragraph */}
          <View style={styles.infoRow}>
            <View style={styles.imageWrapper}>
              <Image
                source={LocalAssets.contact1}
                style={styles.cardImage}
                contentFit="cover"
              />
            </View>

            <View style={styles.cardTextContainer}>
              <Text style={styles.infoText}>
                We can be contacted via email{" "}
                <Text
                  style={styles.linkText}
                  onPress={() => handleEmail(EMAIL_PRIMARY)}
                >
                  {EMAIL_PRIMARY}
                </Text>
                ,{" "}
                <Text
                  style={styles.linkText}
                  onPress={() => handleEmail(EMAIL_SECONDARY)}
                >
                  {EMAIL_SECONDARY}
                </Text>{" "}
                or telephone on{" "}
                <Text style={styles.linkText} onPress={handleCall}>
                  {PHONE_NUMBER}
                </Text>
                .
              </Text>
            </View>
          </View>

          {/* Item 2: Address & Map Button */}
          <View style={styles.infoRow}>
            <View style={styles.imageWrapper}>
              <Image
                source={LocalAssets.contact2}
                style={styles.cardImage}
                contentFit="cover"
              />
            </View>

            <View style={styles.cardTextContainer}>
              <Text style={styles.locationHeading}>{ADDRESS_TEXT}</Text>

              <Pressable style={styles.mapsBtn} onPress={handleOpenMaps}>
                <Text style={styles.mapsBtnText}>View in maps</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── 3. RESERVATION SECTION ── */}
        <View style={styles.reservationWrapper}>
          <ReservationSection />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },

  /* Hero Section */
  heroBg: {
    width: "100%",
  },
  heroOverlay: {
    backgroundColor: "rgba(250, 247, 242, 0.88)",
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: "center",
  },
  heroTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34,
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#555555",
    textAlign: "center",
    marginBottom: 22,
    lineHeight: 20,
  },

  /* Open Time Card */
  openTimeCard: {
    width: "100%",
    backgroundColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 0,
    alignItems: "center",
  },
  openTimeHeading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: "#000000",
    textAlign: "center",
    marginBottom: 4,
  },
  openTimeDays: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: "#0066cc",
    textAlign: "center",
    marginBottom: 16,
  },
  daysBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(230, 126, 34, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(230, 126, 34, 0.25)",
  },
  daysBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
  },
  dottedDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 18,
    width: "80%",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#999999",
  },
  timeGrid: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 4,
  },
  timeSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  timeLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#1a1a1a",
    marginBottom: 4,
    textAlign: "center",
  },
  timeValue: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.orange,
    textAlign: "center",
  },

  /* Info Section */
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 32,
  },
  infoRow: {
    backgroundColor: "transparent",
  },
  imageWrapper: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e5d9cf",
    marginBottom: 16,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardTextContainer: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  infoText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 20,
    lineHeight: 32,
    color: "#2b3621",
  },
  linkText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 20,
    color: "#e37a24",
    textDecorationLine: "underline",
  },
  locationHeading: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 20,
    lineHeight: 32,
    color: "#2b3621",
    marginBottom: 16,
  },
  mapsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#2b3621",
    backgroundColor: "transparent",
  },
  mapsBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#2b3621",
  },

  /* Reservation Section Container */
  reservationWrapper: {
    marginTop: 12,
  },
});
