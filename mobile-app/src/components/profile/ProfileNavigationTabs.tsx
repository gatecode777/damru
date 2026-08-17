import React from "react";
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { colors } from "@/config";
import { AnimatedIcon } from "../ui/AnimatedIcon";

export type ProfileTab = "overview" | "rewards" | "address" | "orders" | "payment" | "coupons" | "help" | "settings";

interface ProfileNavigationTabsProps {
  activeTab: ProfileTab;
  onTabPress: (tab: ProfileTab) => void;
}

const TABS: { id: ProfileTab; label: string; icon: string; activeIcon: string }[] = [
  { id: "overview", label: "My Profile", icon: "person-outline", activeIcon: "person" },
  { id: "rewards", label: "My Rewards", icon: "gift-outline", activeIcon: "gift" },
  { id: "address", label: "Address Book", icon: "book-outline", activeIcon: "book" },
  { id: "orders", label: "My Orders", icon: "bag-handle-outline", activeIcon: "bag-handle" },
  { id: "payment", label: "Payment Methods", icon: "card-outline", activeIcon: "card" },
  { id: "coupons", label: "Offers & Coupons", icon: "pricetag-outline", activeIcon: "pricetag" },
  { id: "help", label: "Help & Support", icon: "help-circle-outline", activeIcon: "help-circle" },
  { id: "settings", label: "Settings", icon: "settings-outline", activeIcon: "settings" },
];

export function ProfileNavigationTabs({ activeTab, onTabPress }: ProfileNavigationTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const iconName = isActive ? tab.activeIcon : tab.icon;

        return (
          <Pressable
            key={tab.id}
            onPress={() => onTabPress(tab.id)}
            style={[
              styles.tab,
              isActive && styles.activeTab,
            ]}
          >
            <AnimatedIcon
              name={iconName}
              size={18}
              color={isActive ? colors.orange : "#756860"}
              active={isActive}
              type="spring"
              style={styles.icon}
            />
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    height: 64,
    flexGrow: 0,
    backgroundColor: "#faf9f6",
  },
  container: {
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
    height: "100%",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eee3da",
  },
  activeTab: {
    backgroundColor: "rgba(229, 121, 34, 0.1)",
    borderColor: "rgba(229, 121, 34, 0.25)",
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: "#756860",
  },
  activeLabel: {
    color: colors.orange,
    fontFamily: "Poppins_600SemiBold",
  },
});
