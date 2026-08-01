import React from "react";
import { View, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { HomeHeader } from "../components/home/HomeHeader";
import { ReservationSection } from "../components/home/ReservationSection";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ReserveScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#fff9f4" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeHeader />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        <ReservationSection />
      </ScrollView>
    </View>
  );
}
