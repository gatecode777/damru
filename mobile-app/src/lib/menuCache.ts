import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MenuItem } from "@/types";

const MENU_CACHE_KEY = "damru.mobile.menu.v1";

export type MenuPayload = {
  categories: Array<{ _id: string; name: string; slug: string; description: string }>;
  items: MenuItem[];
};

export async function readMenuCache(): Promise<MenuPayload | undefined> {
  try {
    const raw = await AsyncStorage.getItem(MENU_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as MenuPayload;
    return Array.isArray(parsed.categories) && Array.isArray(parsed.items) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function writeMenuCache(payload: MenuPayload): Promise<void> {
  try {
    await AsyncStorage.setItem(MENU_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // A storage failure should never prevent the live menu from rendering.
  }
}
