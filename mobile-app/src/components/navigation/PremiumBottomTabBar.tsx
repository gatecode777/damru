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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  useDerivedValue,
} from "react-native-reanimated";

import { colors } from "@/config";

const { width: SW } = Dimensions.get("window");

const getIconName = (routeName: string, isFocused: boolean) => {
  switch (routeName) {
    case "index":
      return isFocused ? "home" : "home-outline";
    case "menu":
      return isFocused ? "restaurant" : "restaurant-outline";
    case "branches":
      return isFocused ? "location" : "location-outline";
    case "gallery":
      return isFocused ? "images" : "images-outline";
    case "profile":
      return isFocused ? "person" : "person-outline";
    default:
      return "help-outline";
  }
};

export function PremiumBottomTabBar({
  state,
  descriptors,
  navigation,
}: any) {
  const insets = useSafeAreaInsets();

  // Floating offset calculation
  const bottomPosition = insets.bottom > 0 ? insets.bottom + 8 : 16;

  return (
    <View style={[styles.barWrapper, { bottom: bottomPosition }]}>
      <View style={styles.barContainer}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;
          const badgeCount = options.tabBarBadge as number | undefined;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate({ name: route.name, merge: true });
            }
          };

          return (
            <TabItem
              key={route.key}
              label={String(label)}
              routeName={route.name}
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
  routeName: string;
  isFocused: boolean;
  badgeCount?: number;
  onPress: () => void;
}

function TabItem({
  label,
  routeName,
  isFocused,
  badgeCount,
  onPress,
}: TabItemProps) {
  const scale = useSharedValue(1);
  const activeProgress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    activeProgress.value = withTiming(isFocused ? 1 : 0, { duration: 250 });
  }, [isFocused]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withTiming(isFocused ? 1.12 : 1.0, { duration: 200 }),
        },
      ],
    };
  });

  const animatedLabelStyle = useAnimatedStyle(() => {
    const textColor = interpolateColor(
      activeProgress.value,
      [0, 1],
      ["#8d817a", colors.orange] // Charcoal inactive to Brand Orange active color
    );
    return {
      color: textColor,
    };
  });

  const animatedDotStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withTiming(isFocused ? 1.0 : 0.0, { duration: 200 }),
        },
      ],
      opacity: withTiming(isFocused ? 1.0 : 0.0, { duration: 200 }),
    };
  });

  const handlePressIn = () => {
    scale.value = withTiming(0.92, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1.0, { duration: 150 });
  };

  const animatedWrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconName = getIconName(routeName, isFocused);

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
          {/* Active/Inactive Styled Icons */}
          <Animated.View style={animatedIconStyle}>
            <Ionicons
              name={iconName as any}
              size={23}
              color={isFocused ? colors.orange : "#8d817a"}
            />
          </Animated.View>

          {/* Dynamic Cart Count Badging */}
          {badgeCount && badgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {badgeCount > 99 ? "99+" : badgeCount}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Small label texts */}
        <Animated.Text style={[styles.labelText, animatedLabelStyle]}>
          {label}
        </Animated.Text>

        {/* Selected Accent Dot indicator */}
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
    zIndex: 1000,
    elevation: 8,
  },
  barContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff", // Pure white for crisp shadow contrast
    borderRadius: 28,
    height: 64,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "rgba(229, 217, 207, 0.35)", // Subtle cream border accent
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
    backgroundColor: colors.orange, // Small orange active indicator dot
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
