import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useFonts, PlayfairDisplay_800ExtraBold, PlayfairDisplay_700Bold, PlayfairDisplay_500Medium, PlayfairDisplay_400Regular } from "@expo-google-fonts/playfair-display";
import { Montserrat_400Regular, Montserrat_600SemiBold, Montserrat_700Bold } from "@expo-google-fonts/montserrat";
import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "@/providers/AppProvider";
import { colors } from "@/config";
import { ActivityIndicator, AppState, Image, Platform, StatusBar, StyleSheet, View, type AppStateStatus } from "react-native";

import { GlobalBottomBar } from "@/components/navigation/GlobalBottomBar";

import { useApp } from "@/providers/AppProvider";

function RootLayoutContent({ fontsLoaded, fontError }: { fontsLoaded: boolean; fontError: any }) {
  const { ready } = useApp();
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [startupTimeoutElapsed, setStartupTimeoutElapsed] = useState(false);

  useEffect(() => {
    const minimumTimer = setTimeout(() => setMinimumSplashElapsed(true), 1200);
    const timeoutTimer = setTimeout(() => setStartupTimeoutElapsed(true), 4000);
    return () => {
      clearTimeout(minimumTimer);
      clearTimeout(timeoutTimer);
    };
  }, []);

  useEffect(() => {
    function onAppStateChange(status: AppStateStatus) {
      if (Platform.OS !== "web") {
        focusManager.setFocused(status === "active");
      }
    }
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

  const startupReady = ((fontsLoaded || Boolean(fontError)) && ready) || startupTimeoutElapsed;

  if (!minimumSplashElapsed || !startupReady) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF9F4" />
        <Image
          source={require("../../assets/images/splash-icon.png")}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator color={colors.orange} size="small" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" translucent={true} backgroundColor="transparent" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="contact-us" options={{ headerShown: false }} />
        <Stack.Screen name="about-us" options={{ headerShown: false }} />
        <Stack.Screen name="branches/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ presentation: "transparentModal", headerShown: false }} />
        <Stack.Screen name="cart" options={{ title: "Your Cart" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="reserve" options={{ title: "Reserve a Table" }} />
        <Stack.Screen name="banquet" options={{ title: "Plan an Event" }} />
        <Stack.Screen name="blogs" options={{ title: "Food Stories" }} />
      </Stack>
      <GlobalBottomBar />
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    backgroundColor: "#FFF9F4",
  },
  splashLogo: {
    width: 96,
    height: 96,
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_800ExtraBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_400Regular,
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppProvider>
          <RootLayoutContent fontsLoaded={fontsLoaded} fontError={fontError} />
        </AppProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
