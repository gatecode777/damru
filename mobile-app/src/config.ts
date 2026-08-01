import Constants from "expo-constants";

const configuredUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  "http://10.0.2.2:3000";

export const API_URL = String(configuredUrl).replace(/\/+$/, "");

export const assetUrl = (folder: string, value?: string) => {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_URL}/uploads/${folder}/${value.replace(/^\/+/, "")}`;
};

export const avatarUrl = (avatar?: string) => {
  if (!avatar) return undefined;
  const base = assetUrl("avatars", avatar);
  if (!base) return undefined;
  // Use the unique filename as a version cache-key query param
  return `${base}?v=${encodeURIComponent(avatar)}`;
};

export const colors = {
  ink: "#21150f",
  muted: "#756860",
  cream: "#fff9f4",
  paper: "#ffffff",
  orange: "#e57922",
  orangeDark: "#bd5612",
  line: "#eee3da",
  green: "#198754",
  danger: "#c0392b",
};
