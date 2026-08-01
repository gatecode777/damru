import React, { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";

import { colors } from "@/config";
import { useApp } from "@/providers/AppProvider";

const NAV_ITEMS = [
  { route: "index",    label: "Home",     path: "/(tabs)",          icon: "home-outline",     activeIcon: "home" },
  { route: "menu",     label: "Menu",     path: "/(tabs)/menu",     icon: "restaurant-outline", activeIcon: "restaurant" },
  { route: "branches", label: "Branches", path: "/(tabs)/branches", icon: "location-outline",   activeIcon: "location" },
  { route: "gallery",  label: "Gallery",  path: "/(tabs)/gallery",  icon: "images-outline",     activeIcon: "images" },
  { route: "profile",  label: "Profile",  path: "/(tabs)/profile",  icon: "person-outline",     activeIcon: "person" },
];

export function GlobalBottomBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems } = useApp();

  const cleanPath = pathname.replace(/^\/\(tabs\)/, "");
  const isTabRoute = [
    "/",
    "/index",
    "/menu",
    "/branches",
    "/gallery",
    "/profile"
  ].includes(cleanPath === "" ? "/" : cleanPath);

  if (!isTabRoute) return null;

  const bottomPosition = insets.bottom > 0 ? insets.bottom + 8 : 16;

  return (
    <View style={[styles.barWrapper, { bottom: bottomPosition }]} pointerEvents="box-none">
      <View style={styles.barContainer}>
        {NAV_ITEMS.map((item) => {
          let isFocused = false;
          if (item.route === "index") {
            isFocused = pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/";
          } else if (item.route === "menu") {
            isFocused = pathname.includes("menu");
          } else if (item.route === "branches") {
            isFocused = pathname.includes("branches");
          } else if (item.route === "gallery") {
            isFocused = pathname.includes("gallery");
          } else if (item.route === "profile") {
            isFocused = pathname.includes("profile") || pathname.includes("my-profile");
          }

          const badgeCount = item.route === "menu" ? totalItems || undefined : undefined;

          const onPress = () => {
            if (item.route === "index") {
              router.push("/(tabs)");
            } else if (item.route === "menu") {
              router.push("/(tabs)/menu");
            } else if (item.route === "branches") {
              router.push("/(tabs)/branches");
            } else if (item.route === "gallery") {
              router.push("/(tabs)/gallery");
            } else if (item.route === "profile") {
              router.push("/(tabs)/profile");
            }
          };

          return (
            <TabItem
              key={item.route}
              label={item.label}
              icon={item.icon}
              activeIcon={item.activeIcon}
              isFocused={isFocused}
              badgeCount={badgeCount}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabItemProps {
  label: string;
  icon: string;
  activeIcon: string;
  isFocused: boolean;
  badgeCount?: number;
  onPress: () => void;
}

function TabItem({
  label,
  icon,
  activeIcon,
  isFocused,
  badgeCount,
  onPress,
}: TabItemProps) {
  const scale = useSharedValue(1);
  const activeProgress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    activeProgress.value = withTiming(isFocused ? 1 : 0, { duration: 250 });
  }, [isFocused]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(isFocused ? 1.12 : 1.0, { duration: 200 }) }],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => {
    const textColor = interpolateColor(
      activeProgress.value,
      [0, 1],
      ["#8d817a", colors.orange]
    );
    return { color: textColor };
  });

  const animatedDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(isFocused ? 1.0 : 0.0, { duration: 200 }) }],
    opacity: withTiming(isFocused ? 1.0 : 0.0, { duration: 200 }),
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.92, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1.0, { duration: 150 });
  };

  const animatedWrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const currentIcon = isFocused ? activeIcon : icon;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={`Tab ${label}`}
    >
      <Animated.View style={[styles.itemContent, animatedWrapperStyle]}>
        <View style={styles.iconContainer}>
          <Animated.View style={animatedIconStyle}>
            <Ionicons
              name={currentIcon as any}
              size={23}
              color={isFocused ? colors.orange : "#8d817a"}
            />
          </Animated.View>

          {badgeCount && badgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {badgeCount > 99 ? "99+" : badgeCount}
              </Text>
            </View>
          ) : null}
        </View>

        <Animated.Text style={[styles.labelText, animatedLabelStyle]}>
          {label}
        </Animated.Text>

        <Animated.View style={[styles.activeDot, animatedDotStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  barContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 28,
    height: 64,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "rgba(229, 217, 207, 0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingTop: 4,
  },
  iconContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    height: 24,
    width: 24,
  },
  labelText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 9.5,
    marginTop: 3,
    fontWeight: "600",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.orange,
    position: "absolute",
    bottom: -6,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -8,
    backgroundColor: colors.orange,
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 8.5,
    fontFamily: "Poppins_700Bold",
    lineHeight: 11,
    textAlign: "center",
  },
});
