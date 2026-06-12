import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISiteSettings extends Document {
  // General
  siteName: string;
  siteUrl: string;
  supportEmail: string;
  tagline: string;
  phone: string;
  address: string;
  currency: string;
  timezone: string;

  // SMTP (for email sending)
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;   // stored encrypted ideally, but plaintext for now
  smtpSecure: boolean;
  smtpFromName: string;

  // Notifications (flags)
  notifyNewUser: boolean;
  notifyNewOrder: boolean;
  notifyReservation: boolean;
  notifyComplaint: boolean;

  // Order settings
  taxRate: number;   // percentage e.g. 5
  freeDeliveryAbove: number;   // e.g. 500 rupees
  deliveryCharge: number;   // flat rate when below threshold

  // Maintenance
  maintenanceMode: boolean;
  maintenanceMsg: string;

  updatedAt: Date;
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    siteName: { type: String, default: "Damru By Namo" },
    siteUrl: { type: String, default: "https://damrurestro.com" },
    supportEmail: { type: String, default: "info@damrurestro.com" },
    tagline: { type: String, default: "Banquet | Restaurant" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },

    smtpHost: { type: String, default: "smtp.gmail.com" },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: "" },
    smtpPass: { type: String, default: "" },
    smtpSecure: { type: Boolean, default: false },
    smtpFromName: { type: String, default: "Damru By Namo" },

    notifyNewUser: { type: Boolean, default: true },
    notifyNewOrder: { type: Boolean, default: true },
    notifyReservation: { type: Boolean, default: true },
    notifyComplaint: { type: Boolean, default: true },

    taxRate: { type: Number, default: 5 },
    freeDeliveryAbove: { type: Number, default: 500 },
    deliveryCharge: { type: Number, default: 50 },

    maintenanceMode: { type: Boolean, default: false },
    maintenanceMsg: { type: String, default: "We'll be back soon!" },
  },
  { timestamps: true }
);

const SiteSettings: Model<ISiteSettings> =
  mongoose.models.SiteSettings ||
  mongoose.model<ISiteSettings>("SiteSettings", SiteSettingsSchema);

export default SiteSettings;