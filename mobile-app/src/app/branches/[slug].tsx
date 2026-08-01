import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HomeHeader } from "../../components/home/HomeHeader";
import BranchHallCard from "../../components/branches/BranchHallCard";
import BranchInquiryForm from "../../components/branches/BranchInquiryForm";
import { colors } from "../../config";
import { get } from "../../lib/api";
import { LocalAssets, getWebImageUri } from "../../constants/assets";
import type { Branch } from "../../types";

const STATIC_FALLBACK: Branch[] = [
  {
    _id: "f1",
    name: "Damru By Namo (Mansarovar, Jaipur)",
    slug: "mansarovar-jaipur",
    description:
      "Our Mansarovar branch offers a perfect blend of great food and a spacious hall for wedding events, ideal for birthdays, family gatherings, and celebrations.",
    contact: "+91 9660527210",
    timing: "11:00 AM – 11:00 PM",
    cardImage: "",
    address: "Coaching Hub Road, Mansarovar, Jaipur - 302020",
    whyChoose: "Uncompromised hygiene, beautiful interior design, and dedicated service staff for a smooth wedding and event experience.",
    offerItems: ["Premium Pure Vegetarian Buffet", "Spacious Air-Conditioned Hall", "Professional Stage & Sound Setup", "In-House Custom Decors"],
    eventTypes: [
      { label: "Birthday Party", image: "" },
      { label: "Anniversary Celebrations", image: "" },
      { label: "Corporate Gathering", image: "" },
    ],
    hallCards: [
      {
        title: "Grand Wedding & Event Hall",
        subtitle: "Host Royal Gatherings Natively",
        description: "A premium wedding and event space designed to handle large guest lists with state of the art presentation and sound setups.",
        features: ["Capacity up to 300 guests", "Full stage setup with thematic lightning", "Valet parking service availability"],
        perfectFor: ["Weddings", "Reception Ceremonies", "Corporate Seminars"],
        images: ["", ""],
        sortOrder: 1,
      },
    ],
  },
  {
    _id: "f2",
    name: "Damru By Namo (Gandhipath, Vaishali, Jaipur)",
    slug: "vaishali-jaipur",
    description:
      "Located in Vaishali Nagar, this branch is perfect for weddings, corporate events, and grand celebrations with modern facilities and expert catering.",
    contact: "+91 9660527210",
    timing: "11:00 AM – 11:00 PM",
    cardImage: "",
    address: "Gandhi Path West, Vaishali Nagar, Jaipur - 302021",
    whyChoose: "Located in the heart of Vaishali Nagar with ample parking space and highly experienced catering chefs.",
    offerItems: ["Luxury Banquet Space", "Customized Food Counters", "Modern Sound Systems", "Theme Lighting & Decoration"],
    eventTypes: [
      { label: "Wedding Ceremony", image: "" },
      { label: "Pre-Wedding Functions", image: "" },
      { label: "Social Meets", image: "" },
    ],
    hallCards: [
      {
        title: "Celebration Lounge",
        subtitle: "Luxury Meets Delight",
        description: "Perfect space for high-end corporate dinners and intimate pre-wedding functions under aesthetic lights.",
        features: ["Premium seating arrangement", "Dedicated buffet zone", "State-of-the-art acoustics"],
        perfectFor: ["Corporate Dinners", "Mehndi & Sangeet", "Family Gatherings"],
        images: ["", ""],
        sortOrder: 1,
      },
    ],
  },
  {
    _id: "f3",
    name: "Damru By Namo (Coaching Hub, Pratap Nagar, Jaipur)",
    slug: "pratap-nagar-jaipur",
    description:
      "Our Pratap Nagar branch offers a lively dining experience along with wedding and event services, making it ideal for student parties, birthdays, and casual events.",
    contact: "+91 9660527210",
    timing: "11:00 AM – 11:00 PM",
    cardImage: "",
    address: "Coaching Hub Sector 16, Pratap Nagar, Jaipur - 302033",
    whyChoose: "Extremely affordable packages tailored for students, casual celebrations, and corporate get-togethers.",
    offerItems: ["Affordable Party Packages", "Dj & Music Setup Options", "Multi-Cuisine Buffet Menus", "Quick Event Services"],
    eventTypes: [
      { label: "Student Parties", image: "" },
      { label: "Birthday Bashes", image: "" },
      { label: "Farewells & Gatherings", image: "" },
    ],
    hallCards: [
      {
        title: "Mini Party Lounge",
        subtitle: "Lively Beats & Fresh Taste",
        description: "Cosy yet vibrant space perfect for student events, corporate lunch breaks, and milestone celebrations.",
        features: ["High energy sound setup", "Customisable fast-food options", "Vibrant decor themes"],
        perfectFor: ["Birthday Parties", "Farewells", "Student Gathering"],
        images: ["", ""],
        sortOrder: 1,
      },
    ],
  },
];

export default function BranchDetailPage() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();

  const [branch, setBranch] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<{ branches: any[] }>("/api/branches")
      .then((d) => {
        const list = d.branches && d.branches.length > 0 ? d.branches : STATIC_FALLBACK;
        const found = list.find((b) => b.slug === slug);
        setBranch(found || null);
      })
      .catch(() => {
        const found = STATIC_FALLBACK.find((b) => b.slug === slug);
        setBranch(found || null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.orange} />
      </View>
    );
  }

  if (!branch) {
    return (
      <View style={styles.notFoundContainer}>
        <HomeHeader />
        <View style={styles.notFoundBody}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.orange} />
          <Text style={styles.notFoundTitle}>Branch Not Found</Text>
          <Text style={styles.notFoundText}>
            The branch you are looking for does not exist or has been relocated.
          </Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Banner source
  const bannerSource = branch.bannerImage
    ? { uri: getWebImageUri(`/uploads/branches/${branch.bannerImage}`) }
    : LocalAssets.contactHeroBg;

  // Intro thumbnail source
  const thumbnailSource = branch.cardImage
    ? { uri: getWebImageUri(`/uploads/branches/${branch.cardImage}`) }
    : LocalAssets.contact1;

  return (
    <View style={styles.page}>
      <HomeHeader />

      {/* Floating Back Button */}
      <Pressable style={[styles.floatingBackBtn, { top: insets.top + 60 }]} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color={colors.ink} />
      </Pressable>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 75 }}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1 — HERO BANNER */}
        <View style={styles.heroSection}>
          <Image
            source={bannerSource}
            style={styles.heroImg}
            contentFit="cover"
          />
          <View style={styles.heroOverlay} />
        </View>

        {/* SECTION 2 — BRANCH INTRO */}
        <View style={styles.introSection}>
          <Text style={styles.branchTitle}>{branch.name}</Text>
          <View style={styles.divider} />
          
          {branch.description ? (
            <Text style={styles.branchDesc}>{branch.description}</Text>
          ) : null}

          {/* Contact & Timing meta details */}
          {(branch.contact || branch.timing) && (
            <View style={styles.metaContainer}>
              {branch.contact ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Contact Us:</Text>
                  <Text style={styles.metaVal}>{branch.contact}</Text>
                </View>
              ) : null}
              {branch.timing ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Timing:</Text>
                  <Text style={styles.metaVal}>{branch.timing}</Text>
                </View>
              ) : null}
              {branch.address ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Address:</Text>
                  <Text style={styles.metaVal}>{branch.address}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Intro Thumbnail card image */}
          {branch.cardImage || thumbnailSource ? (
            <View style={styles.thumbnailWrapper}>
              <Image
                source={thumbnailSource}
                style={styles.thumbnail}
                contentFit="cover"
              />
            </View>
          ) : null}

          {/* What We Offer */}
          {branch.offerItems && branch.offerItems.length > 0 ? (
            <View style={styles.offerSection}>
              <Text style={styles.offerHeading}>What We Offer</Text>
              {branch.offerItems.map((item: string, i: number) => (
                <View key={i} style={styles.offerRow}>
                  <Ionicons name="checkmark-sharp" size={16} color={colors.orange} style={styles.checkIcon} />
                  <Text style={styles.offerText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Why Choose Damru? */}
          {branch.whyChoose ? (
            <View style={styles.whySection}>
              <Text style={styles.whyHeading}>Why Choose Damru?</Text>
              <Text style={styles.whyText}>{branch.whyChoose}</Text>
            </View>
          ) : null}
        </View>

        {/* SECTION 3 — EVENT TYPES */}
        {branch.eventTypes && branch.eventTypes.length > 0 ? (
          <View style={styles.eventsSection}>
            <Text style={styles.sectionHeading}>Event Types We Host</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.eventsScrollContent}
            >
              {branch.eventTypes.map((ev: any, i: number) => {
                const eventImg = ev.image
                  ? { uri: getWebImageUri(`/uploads/branches/${ev.image}`) }
                  : LocalAssets.drink;
                return (
                  <View key={i} style={styles.eventCard}>
                    <View style={styles.eventImgWrap}>
                      <Image
                        source={eventImg}
                        style={styles.eventImg}
                        contentFit="cover"
                      />
                    </View>
                    <Text style={styles.eventLabel}>{ev.label}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* SECTIONS 4+ — ALTERNATING BANQUET HALL CARDS */}
        {branch.hallCards && branch.hallCards.length > 0 ? (
          <View style={styles.hallSection}>
            {branch.hallCards
              .sort((a: any, x: any) => (a.sortOrder || 0) - (x.sortOrder || 0))
              .map((hall: any, i: number) => (
                <BranchHallCard key={i} hall={hall} index={i} />
              ))}
          </View>
        ) : null}

        {/* PLAN YOUR EVENT - CTA RESERVATION FORM */}
        <BranchInquiryForm
          branchSlug={branch.slug}
          branchName={branch.name}
          ctaTitle={branch.ctaTitle}
          ctaSubtitle={branch.ctaSubtitle}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  notFoundContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  notFoundBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  notFoundTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: colors.ink,
    marginTop: 18,
    marginBottom: 8,
  },
  notFoundText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#6b6560",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: 24,
    height: 44,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  backBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
  },
  scrollView: {
    flex: 1,
  },
  floatingBackBtn: {
    position: "absolute",
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroSection: {
    width: "100%",
    height: 240,
    position: "relative",
    backgroundColor: "#e8e0d5",
  },
  heroImg: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 100%)",
  },
  introSection: {
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  branchTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: colors.ink,
    lineHeight: 34,
    marginBottom: 6,
  },
  divider: {
    width: 50,
    height: 3,
    backgroundColor: colors.orange,
    marginBottom: 20,
    borderRadius: 1.5,
  },
  branchDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#2e2a26",
    lineHeight: 22,
    marginBottom: 20,
    textAlign: "justify",
  },
  metaContainer: {
    backgroundColor: "#faf8f5",
    borderWidth: 1,
    borderColor: "#e0d8ce",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  metaLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13.5,
    color: colors.ink,
    width: 95,
  },
  metaVal: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13.5,
    color: "#2e2a26",
    flex: 1,
  },
  thumbnailWrapper: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
    backgroundColor: "#faf8f5",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  offerSection: {
    marginBottom: 24,
  },
  offerHeading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: colors.orange,
    marginBottom: 12,
  },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  checkIcon: {
    marginRight: 10,
  },
  offerText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#2e2a26",
  },
  whySection: {
    marginBottom: 12,
  },
  whyHeading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: colors.ink,
    marginBottom: 10,
  },
  whyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#2e2a26",
    lineHeight: 22,
    textAlign: "justify",
  },
  eventsSection: {
    backgroundColor: "#fdf8f4",
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  sectionHeading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: colors.ink,
    textAlign: "center",
    marginBottom: 24,
  },
  eventsScrollContent: {
    gap: 16,
    paddingHorizontal: 4,
  },
  eventCard: {
    width: 140,
    alignItems: "center",
  },
  eventImgWrap: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: "hidden",
    marginBottom: 10,
    backgroundColor: "#faf8f5",
    borderWidth: 1.5,
    borderColor: "#e3ddd6",
  },
  eventImg: {
    width: "100%",
    height: "100%",
  },
  eventLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.ink,
    textAlign: "center",
  },
  hallSection: {
    width: "100%",
  },
});
