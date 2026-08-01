import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

function SkeletonBlock({ style }: { style?: any }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.ease }),
        withTiming(0.4, { duration: 800, easing: Easing.ease }),
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.skeletonBase, style, animatedStyle]} />;
}

export function LoadingSkeleton() {
  return (
    <View style={styles.container}>
      {/* Tabs Skeleton */}
      <View style={styles.tabsRow}>
        {[1, 2, 3].map((i) => (
          <SkeletonBlock key={i} style={styles.tabSkeleton} />
        ))}
      </View>

      {/* Profile Card Skeleton */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <SkeletonBlock style={styles.avatarSkeleton} />
          <View style={styles.userInfo}>
            <SkeletonBlock style={styles.textLineLong} />
            <SkeletonBlock style={styles.textLineShort} />
          </View>
        </View>
        <SkeletonBlock style={styles.buttonSkeleton} />
      </View>

      {/* List Card Skeletons */}
      {[1, 2].map((i) => (
        <View key={i} style={styles.card}>
          <View style={styles.header}>
            <SkeletonBlock style={styles.titleSkeleton} />
            <SkeletonBlock style={styles.linkSkeleton} />
          </View>
          <SkeletonBlock style={styles.contentBlock} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf9f6",
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabSkeleton: {
    width: 100,
    height: 38,
    borderRadius: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eee3da",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarSkeleton: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
    gap: 8,
  },
  textLineLong: {
    width: "70%",
    height: 18,
    borderRadius: 4,
  },
  textLineShort: {
    width: "50%",
    height: 13,
    borderRadius: 4,
  },
  buttonSkeleton: {
    width: "100%",
    height: 46,
    borderRadius: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  titleSkeleton: {
    width: "40%",
    height: 18,
    borderRadius: 4,
  },
  linkSkeleton: {
    width: "15%",
    height: 14,
    borderRadius: 4,
  },
  contentBlock: {
    width: "100%",
    height: 56,
    borderRadius: 14,
  },
  skeletonBase: {
    backgroundColor: "#eee3da",
  },
});
