import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAddress extends Document {
  userId:    mongoose.Types.ObjectId;
  label:     "Home" | "Office" | "Other";
  fullName:  string;
  phone:     string;
  house:     string;
  area:      string;
  city:      string;
  state:     string;
  pincode:   string;
  latitude?: number;
  longitude?: number;
  geocodedAddress?: string;
  geocodedAt?: Date;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    label:     { type: String, enum: ["Home", "Office", "Other"], default: "Home" },
    fullName:  { type: String, required: true, trim: true },
    phone:     { type: String, required: true, trim: true },
    house:     { type: String, required: true, trim: true },
    area:      { type: String, default: "", trim: true },
    city:      { type: String, required: true, trim: true },
    state:     { type: String, required: true, trim: true },
    pincode:   { type: String, required: true, trim: true },
    latitude:  { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    geocodedAddress: { type: String, default: "" },
    geocodedAt: { type: Date },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AddressSchema.index({ userId: 1 });

const Address: Model<IAddress> =
  mongoose.models.Address || mongoose.model<IAddress>("Address", AddressSchema);

export default Address;
