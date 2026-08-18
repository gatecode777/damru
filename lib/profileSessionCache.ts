export interface ProfileSessionUser {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  avatar?: string;
  createdAt?: string;
}

const PROFILE_USER_KEY = "damru_profile_user";

export function readProfileSessionUser(): ProfileSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(PROFILE_USER_KEY);
    if (!value) return null;
    const user = JSON.parse(value) as Partial<ProfileSessionUser>;
    return user.name && user.email ? (user as ProfileSessionUser) : null;
  } catch {
    return null;
  }
}

export function writeProfileSessionUser(user: ProfileSessionUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) window.sessionStorage.setItem(PROFILE_USER_KEY, JSON.stringify(user));
    else window.sessionStorage.removeItem(PROFILE_USER_KEY);
  } catch {
    // Storage may be unavailable in private/restricted browser contexts.
  }
}
