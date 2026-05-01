import mongoose, { Schema, Document, Model } from "mongoose";

export type BookingStatus = "new" | "contacted" | "confirmed" | "cancelled";

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
    fullName:   { type: String, required: true, trim: true, maxlength: 100 },
    phone:      { type: String, required: true, trim: true, maxlength: 20 },
    email:      { type: String, required: true, trim: true, lowercase: true },
    branchSlug: { type: String, default: "", trim: true },
    branchName: { type: String, default: "", trim: true },
    eventType:  { type: String, default: "", trim: true },
    eventDate:  { type: String, default: "" },
    guestCount: { type: String, default: "" },
    message:    { type: String, default: "", trim: true, maxlength: 1000 },
    status:     { type: String, enum: ["new","contacted","confirmed","cancelled"], default: "new" },
    adminNote:  { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

const BanquetBooking: Model<IBanquetBooking> =
  mongoose.models.BanquetBooking ||
  mongoose.model<IBanquetBooking>("BanquetBooking", BanquetBookingSchema);

export default BanquetBooking;