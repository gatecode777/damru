import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ColorValue } from "react-native";
import { colors } from "@/config";
import { useApp } from "@/providers/AppProvider";

const icon = (name: keyof typeof MaterialIcons.glyphMap) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialIcons name={name} color={color} size={size} />;
  };

export default function TabsLayout() {
  const { totalItems } = useApp();
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.orange,
    tabBarInactiveTintColor: "#8d817a",
    tabBarStyle: { height: 66, paddingTop: 6, paddingBottom: 8, borderTopColor: colors.line, backgroundColor: "#fff" },
    tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
  }}>
    <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home") }} />
    <Tabs.Screen name="menu" options={{ title: "Menu", tabBarIcon: icon("restaurant-menu"), tabBarBadge: totalItems || undefined }} />
    <Tabs.Screen name="branches" options={{ title: "Branches", tabBarIcon: icon("location-on") }} />
    <Tabs.Screen name="gallery" options={{ title: "Gallery", tabBarIcon: icon("photo-library") }} />
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("person") }} />
  </Tabs>;
}
