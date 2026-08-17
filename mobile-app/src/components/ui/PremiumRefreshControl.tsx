import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  RefreshControl,
  type RefreshControlProps,
  StyleSheet,
  View,
} from "react-native";

type Props = RefreshControlProps & { children?: React.ReactNode };

/** Native pull-to-refresh behavior with a branded Damru progress indicator. */
export function PremiumRefreshControl({ refreshing, children, ...props }: Props) {
  const [active, setActive] = useState(refreshing);
  const activeRef = useRef(refreshing);
  const phase = useRef(new Animated.Value(0)).current;
  const startedAtRef = useRef(0);

  const finishAfterMinimumDuration = useCallback(() => {
    const remaining = Math.max(0, 850 - (Date.now() - startedAtRef.current));
    const timer = setTimeout(() => {
      activeRef.current = false;
      setActive(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    startedAtRef.current = Date.now();
    setActive(true);
    try {
      await Promise.resolve(props.onRefresh?.());
    } finally {
      finishAfterMinimumDuration();
    }
  }, [finishAfterMinimumDuration, props]);

  useEffect(() => {
    if (refreshing) {
      if (!activeRef.current) startedAtRef.current = Date.now();
      activeRef.current = true;
      setActive(true);
      return;
    }

    if (activeRef.current && startedAtRef.current > 0) return finishAfterMinimumDuration();
  }, [finishAfterMinimumDuration, refreshing]);

  useEffect(() => {
    if (!active) {
      phase.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => {
      animation.stop();
      phase.setValue(0);
    };
  }, [active, phase]);

  const rotate = phase.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const { onRefresh: _onRefresh, ...nativeProps } = props;

  return (
    <View style={styles.host}>
      <RefreshControl
        {...nativeProps}
        refreshing={active}
        onRefresh={handleRefresh}
        colors={["transparent"]}
        tintColor="transparent"
        progressBackgroundColor="transparent"
        progressViewOffset={-100}
      >
        {children}
      </RefreshControl>
      {active ? (
        <View pointerEvents="none" style={styles.indicator}>
          <View style={styles.circle}>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Image source={require("../../../assets/images/damru-refresh-icon.png")} style={styles.mark} resizeMode="contain" />
            </Animated.View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  indicator: { position: "absolute", top: 7, left: 0, right: 0, alignItems: "center", zIndex: 20 },
  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0dfd5",
    shadowColor: "#5f2b1d",
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mark: { width: 31, height: 31 },
});
