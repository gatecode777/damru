/**
 * lib/getSettings.ts
 * Server-side utility to fetch SiteSettings from DB.
 * Returns defaults if DB unavailable.
 * Use in server components and API routes.
 */

import { connectDB } from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

export type AppSettings = {
  siteName: string;
  siteUrl: string;
  supportEmail: string;
  tagline: string;
  phone: string;
  address: string;
  currency: string;
  timezone: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  smtpFromName: string;
  notifyNewUser: boolean;
  notifyNewOrder: boolean;
  notifyReservation: boolean;
  notifyComplaint: boolean;
  taxRate: number;
  freeDeliveryAbove: number;
  deliveryCharge: number;
  deliveryRadiusKm: number;
  maintenanceMode: boolean;
  maintenanceMsg: string;
};

const DEFAULTS: AppSettings = {
  siteName: "Damru By Namo",
  siteUrl: "https://damrurestro.com",
  supportEmail: "info@damrurestro.com",
  tagline: "Banquet | Restaurant",
  phone: "",
  address: "",
  currency: "INR",
  timezone: "Asia/Kolkata",
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpUser: "",
  smtpPass: "",
  smtpSecure: false,
  smtpFromName: "Damru By Namo",
  notifyNewUser: true,
  notifyNewOrder: true,
  notifyReservation: true,
  notifyComplaint: true,
  taxRate: 5,
  freeDeliveryAbove: 500,
  deliveryCharge: 50,
  deliveryRadiusKm: 10,
  maintenanceMode: false,
  maintenanceMsg: "We'll be back soon!",
};

import { cache } from "react";
import { unstable_cache } from "next/cache";

const getPersistedSettings = unstable_cache(async (): Promise<AppSettings> => {
  try {
    await connectDB();
    const doc = await SiteSettings.findOne().lean() as unknown as Partial<AppSettings> | null;
    if (!doc) return DEFAULTS;
    // Only return the plain settings contract. Mongoose metadata is unnecessary
    // in the layout and is not guaranteed to be cache-serializable.
    return Object.fromEntries(
      (Object.keys(DEFAULTS) as (keyof AppSettings)[]).map((key) => [key, doc[key] ?? DEFAULTS[key]])
    ) as AppSettings;
  } catch {
    return DEFAULTS;
  }
}, ["site-settings"], { revalidate: 300, tags: ["site-settings"] });

// React cache also deduplicates callers inside the same render pass.
export const getSettings = cache(getPersistedSettings);
