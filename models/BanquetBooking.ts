import mongoose, { Schema, Document, Model } from "mongoose";

export type BookingStatus = "new" | "contacted" | "confirmed" | "cancelled";

const BOOKING_EVENT_TYPES = [
  "", "Birthday Party", "Wedding / Pre-Wedding", "Corporate Event", "Anniversary",
  "Baby Shower", "Cultural Event", "Social Gathering", "Other",
] as const;
const BOOKING_GUEST_COUNTS = ["", "Upto 25", "25 – 50", "50 – 100", "100 – 200", "200 – 500", "500+"] as const;

export interface IBanquetBooking extends Document {
  fullName:    string;
  phone:       string;
  email:       string;
  branchSlug?: string;
  branchName?: string;
  eventType?:  string;
  eventDate?:  string;
  guestCount?: string;
  message?:    string;
  status:      BookingStatus;
  adminNote?:  string;
  createdAt:   Date;
  updatedAt:   Date;
}

const BanquetBookingSchema = new Schema<IBanquetBooking>(
  {
    fullName:   { type: String, required: true, trim: true, minlength: 2, maxlength: 100, match: /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u },
    phone:      { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/ },
    email:      { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    branchSlug: { type: String, required: true, trim: true, maxlength: 120 },
    branchName: { type: String, required: true, trim: true, maxlength: 200 },
    eventType:  { type: String, default: "", trim: true, enum: BOOKING_EVENT_TYPES },
    eventDate:  { type: String, default: "", maxlength: 10 },
    guestCount: { type: String, default: "", enum: BOOKING_GUEST_COUNTS },
    message:    { type: String, default: "", trim: true, maxlength: 1000 },
    status:     { type: String, enum: ["new","contacted","confirmed","cancelled"], default: "new" },
    adminNote:  { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

BanquetBookingSchema.index({ branchSlug: 1, createdAt: -1 });
BanquetBookingSchema.index({ status: 1, createdAt: -1 });

const BanquetBooking: Model<IBanquetBooking> =
  mongoose.models.BanquetBooking ||
  mongoose.model<IBanquetBooking>("BanquetBooking", BanquetBookingSchema);

export default BanquetBooking;
