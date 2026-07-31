import { Tabs } from "expo-router";
import { useApp } from "@/providers/AppProvider";
import { PremiumBottomTabBar } from "@/components/navigation/PremiumBottomTabBar";

export default function TabsLayout() {
  const { totalItems } = useApp();

  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="menu" options={{ title: "Menu", tabBarBadge: totalItems || undefined }} />
      <Tabs.Screen name="branches" options={{ title: "Branches" }} />
      <Tabs.Screen name="gallery" options={{ title: "Gallery" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
