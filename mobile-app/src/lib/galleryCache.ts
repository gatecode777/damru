import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GalleryTab } from "@/types";

const GALLERY_CACHE_KEY = "damru.mobile.gallery.v1";

export type GalleryPayload = { tabs: GalleryTab[] };

export async function readGalleryCache(): Promise<GalleryPayload | undefined> {
  try {
    const raw = await AsyncStorage.getItem(GALLERY_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as GalleryPayload;
    return Array.isArray(parsed.tabs) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function writeGalleryCache(payload: GalleryPayload): Promise<void> {
  try {
    await AsyncStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // The network response remains usable even when device storage is unavailable.
  }
}
