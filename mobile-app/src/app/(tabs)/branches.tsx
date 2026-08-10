import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";

import { HomeHeader } from "../../components/home/HomeHeader";
import { EmptyState } from "../../components/ui";
import { LocalAssets, getWebImageUri } from "../../constants/assets";
import { useHomepageBranches } from "../../hooks/useHomepageBranches";
import { colors } from "../../config";
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
  },
];

export default function BranchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Shares the same react-query cache/staleTime as the Home tab's branches
  // section instead of firing its own independent fetch every time this
  // screen mounts.
  const { branches: fetchedBranches, loading } = useHomepageBranches();
  const branches: Branch[] = fetchedBranches.length > 0 ? fetchedBranches : STATIC_FALLBACK;

  function handleReadMore(branch: Branch) {
    if (branch.slug) {
      router.push({
        pathname: "/branches/[slug]",
        params: { slug: branch.slug },
      });
    } else {
      router.push("/contact-us");
    }
  }

  function renderBranchCard({ item, index }: { item: Branch; index: number }) {
    // Resolve Image source
    let imageSource;
    if (item.cardImage) {
      imageSource = { uri: getWebImageUri(`/uploads/branches/${item.cardImage}`) };
    } else {
      // Use fallback static image based on index
      if (index === 1) imageSource = LocalAssets.contact2;
      else if (index === 2) imageSource = LocalAssets.contactHeroBg;
      else imageSource = LocalAssets.contact1;
    }

    return (
      <Animated.View
        entering={FadeInUp.delay(index * 120).duration(600)}
        style={styles.card}
      >
        <Pressable onPress={() => handleReadMore(item)} style={styles.cardPressable}>
          <View style={styles.imageWrapper}>
            <Image
              source={imageSource}
              style={styles.image}
              contentFit="cover"
              transition={300}
            />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.name}>{item.name}</Text>
            
            {/* Dotted Divider */}
            <View style={styles.cardDivider}>
              {Array.from({ length: 10 }).map((_, j) => (
                <View key={j} style={styles.dividerDot} />
              ))}
            </View>

            <Text style={styles.description}>{item.description}</Text>

            <View style={styles.metaInfo}>
              {item.contact && (
                <Text style={styles.metaText}>
                  <Text style={styles.metaLabel}>Contact Us: </Text>
                  {item.contact}
                </Text>
              )}
              {item.timing && (
                <Text style={styles.metaText}>
                  <Text style={styles.metaLabel}>Timing: </Text>
                  {item.timing}
                </Text>
              )}
            </View>

            <View style={styles.readMoreRow}>
              <Text style={styles.readMoreText}>Read More</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.ink} />
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  function BranchCardSkeleton() {
    return (
      <View style={styles.card}>
        <View style={[styles.imageWrapper, { backgroundColor: '#f0ece6' }]} />
        <View style={styles.cardBody}>
          <View style={[styles.skeletonLine, { width: '60%', height: 18, marginBottom: 8 }]} />
          <View style={[styles.skeletonLine, { width: '100%', height: 2, marginBottom: 12 }]} />
          <View style={[styles.skeletonLine, { width: '90%', height: 12, marginBottom: 6 }]} />
          <View style={[styles.skeletonLine, { width: '80%', height: 12, marginBottom: 16 }]} />
          <View style={[styles.skeletonLine, { width: '45%', height: 12, marginBottom: 6 }]} />
          <View style={[styles.skeletonLine, { width: '55%', height: 12, marginBottom: 16 }]} />
          <View style={[styles.skeletonLine, { width: '25%', height: 14 }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <HomeHeader />

      <FlatList
        data={loading ? [{ _id: "s1" }, { _id: "s2" }] as any[] : branches}
        keyExtractor={(item) => item._id}
        renderItem={loading ? () => <BranchCardSkeleton /> : renderBranchCard}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 85 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Our Branches</Text>
            <Text style={styles.subtitle}>
              Serving delicious food and unforgettable moments at multiple locations
            </Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="No Branches Available"
              message="We are updating our locations. Please try again later."
            />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
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
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34,
    color: colors.ink,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#6b6560",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: "90%",
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e3ddd6",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressable: {
    width: "100%",
  },
  imageWrapper: {
    width: "100%",
    height: 220,
    backgroundColor: "#faf8f5",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  cardBody: {
    padding: 20,
  },
  name: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: colors.ink,
    lineHeight: 26,
  },
  cardDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginVertical: 12,
  },
  dividerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#c8a96e",
    opacity: 0.7,
  },
  description: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13.5,
    color: "#6b6560",
    lineHeight: 22,
    marginBottom: 16,
  },
  metaInfo: {
    gap: 6,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0ece6",
    paddingTop: 14,
  },
  metaText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: colors.ink,
  },
  metaLabel: {
    fontFamily: "Poppins_600SemiBold",
    color: "#6b6560",
  },
  readMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  readMoreText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13.5,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  skeletonLine: {
    backgroundColor: "#f0ece6",
    borderRadius: 4,
  },
});
