/**
 * lib/getSettings.ts
 * Server-side utility to fetch SiteSettings from DB.
 * Returns defaults if DB unavailable.
 * Use in server components and API routes.
 */

import { connectDB } from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

export type AppSettings = {
  siteName:          string;
  siteUrl:           string;
  supportEmail:      string;
  tagline:           string;
  phone:             string;
  address:           string;
  currency:          string;
  timezone:          string;
  smtpHost:          string;
  smtpPort:          number;
  smtpUser:          string;
  smtpPass:          string;
  smtpSecure:        boolean;
  smtpFromName:      string;
  notifyNewUser:     boolean;
  notifyNewOrder:    boolean;
  notifyReservation: boolean;
  notifyComplaint:   boolean;
  taxRate:           number;
  freeDeliveryAbove: number;
  deliveryCharge:    number;
  maintenanceMode:   boolean;
  maintenanceMsg:    string;
};

const DEFAULTS: AppSettings = {
  siteName:          "Damru By Namo",
  siteUrl:           "https://damrubynamo.com",
  supportEmail:      "support@damrubynamo.com",
  tagline:           "Banquet | Restaurant",
  phone:             "",
  address:           "",
  currency:          "INR",
  timezone:          "Asia/Kolkata",
  smtpHost:          "smtp.gmail.com",
  smtpPort:          587,
  smtpUser:          "",
  smtpPass:          "",
  smtpSecure:        false,
  smtpFromName:      "Damru By Namo",
  notifyNewUser:     true,
  notifyNewOrder:    true,
  notifyReservation: true,
  notifyComplaint:   true,
  taxRate:           5,
  freeDeliveryAbove: 500,
  deliveryCharge:    50,
  maintenanceMode:   false,
  maintenanceMsg:    "We'll be back soon!",
};

import { cache } from "react";

// cache() deduplicates calls within a single request/render pass
// so multiple server components calling getSettings() only hit DB once
export const getSettings = cache(async (): Promise<AppSettings> => {
  try {
    await connectDB();
    const doc = await SiteSettings.findOne().lean() as any;
    if (!doc) return DEFAULTS;
    return { ...DEFAULTS, ...doc };
  } catch {
    return DEFAULTS;
  }
});