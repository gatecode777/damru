import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/config";
import type { User } from "@/types";
import { Image } from "../ui/Image";
import { assetUrl } from "@/config";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

interface UserProfileCardProps {
  user: User;
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const router = useRouter();
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={["#ffffff", "#fffaf5"]}
        style={styles.gradient}
      >
        <View style={styles.profileRow}>
          <View style={styles.avatarBorder}>
            <View style={styles.avatarContainer}>
              {user.avatar ? (
                <Image
                  source={assetUrl("avatars", user.avatar)}
                  style={styles.avatar}
                />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.name}>{user.name}</Text>
            <View style={styles.infoBadgeRow}>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={10} color="#15803d" style={{ marginRight: 2 }} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
              {user.city ? (
                <View style={styles.cityBadge}>
                  <Ionicons name="location-sharp" size={10} color="#e67e22" style={{ marginRight: 2 }} />
                  <Text style={styles.cityText}>{user.city}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.email}>{user.email}</Text>
            {user.phone ? (
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={12} color="#756860" style={{ marginRight: 4 }} />
                <Text style={styles.phoneText}>{user.phone}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/edit-profile")}
          style={({ pressed }) => [
            styles.editBtn,
            pressed && { opacity: 0.9 }
          ]}
          accessibilityRole="button"
          accessibilityLabel="Edit Profile"
        >
          <LinearGradient
            colors={["#ff8a47", "#e67e22"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGradient}
          >
            <Ionicons name="create-outline" size={16} color="#ffffff" style={styles.editIcon} />
            <Text style={styles.editBtnText}>Edit Details</Text>
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee3da",
    shadowColor: "#e67e22",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  gradient: {
    padding: 20,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarBorder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "rgba(229, 121, 34, 0.25)",
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
    backgroundColor: "rgba(229, 121, 34, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: colors.orange,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: colors.ink,
  },
  infoBadgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#c8e6c9",
  },
  verifiedText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: "#15803d",
  },
  cityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(229, 121, 34, 0.06)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "rgba(229, 121, 34, 0.15)",
  },
  cityText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: colors.orange,
  },
  email: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#756860",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  phoneText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#756860",
  },
  editBtn: {
    borderRadius: 12,
    overflow: "hidden",
  },
  btnGradient: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  editIcon: {
    marginRight: 6,
  },
  editBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13.5,
    color: "#ffffff",
  },
});
