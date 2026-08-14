import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  useFonts,
  PlayfairDisplay_800ExtraBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium_Italic,
} from "@expo-google-fonts/playfair-display";
import { Montserrat_400Regular, Montserrat_600SemiBold, Montserrat_700Bold } from "@expo-google-fonts/montserrat";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "@/providers/AppProvider";
import { colors } from "@/config";
import { AppState, Platform, StatusBar, type AppStateStatus } from "react-native";
import { BrandSplash } from "@/components/splash/BrandSplash";

import { GlobalBottomBar } from "@/components/navigation/GlobalBottomBar";

import { useApp } from "@/providers/AppProvider";

// Keep the native splash (see app.json's expo-splash-screen plugin config)
// visible until the JS-rendered BrandSplash has mounted and taken over, so
// there's no blank-white flash between the native and JS splash stages.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

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

  // Hand off from the native splash (static, OS-level) to the JS-rendered
  // BrandSplash (animated) the moment fonts are ready — BrandSplash has
  // already been mounted underneath, so there's no gap between the two.
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  const startupReady = ((fontsLoaded || Boolean(fontError)) && ready) || startupTimeoutElapsed;

  if (!minimumSplashElapsed || !startupReady) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#3d0f16" />
        <BrandSplash fontsLoaded={fontsLoaded || Boolean(fontError)} />
      </>
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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_800ExtraBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium_Italic,
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
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
