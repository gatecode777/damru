import { useEffect } from "react";
import { Stack } from "expo-router";
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
import * as SplashScreen from "expo-splash-screen";
import { AppProvider } from "@/providers/AppProvider";
import { colors } from "@/config";
import { StatusBar } from "react-native";

SplashScreen.preventAutoHideAsync().catch(() => {});

import { GlobalBottomBar } from "@/components/navigation/GlobalBottomBar";

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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
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
      </AppProvider>
    </SafeAreaProvider>
  );
}
