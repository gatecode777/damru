import mongoose, { Schema, Document, Model } from "mongoose";

// Each gallery item inside a tab
export interface IGalleryItem {
  image:        string;   // filename in /uploads/gallery/
  alt:          string;
  title:        string;
  description:  string;   // e.g. "Lunch • Dinner"
  type:         "wide" | "narrow";
  overlayClass: "" | "top-aligned";
  sortOrder:    number;
}

const GalleryItemSchema = new Schema<IGalleryItem>(
  {
    image:       { type: String, required: true },
    alt:         { type: String, default: "" },
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type:        { type: String, enum: ["wide", "narrow"], default: "wide" },
    overlayClass:{ type: String, enum: ["", "top-aligned"], default: "" },
    sortOrder:   { type: Number, default: 0 },
  },
  { _id: true }
);

// One document per tab (All, Starter, Lunch, Dinner, Drinks, Sweets, Fruits)
export interface IGalleryTab extends Document {
  tabKey:      string;    // "all" | "starter" | "lunch" | "dinner" | "drinks" | "sweets" | "fruits"
  label:       string;    // "All" | "Starter" | "Lunch" …
  bannerImage: string;    // filename in /uploads/gallery/
  bannerAlt:   string;
  isActive:    boolean;
  sortOrder:   number;
  items:       IGalleryItem[];
  createdAt:   Date;
  updatedAt:   Date;
}

const GalleryTabSchema = new Schema<IGalleryTab>(
  {
    tabKey:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    label:       { type: String, required: true, trim: true },
    bannerImage: { type: String, default: "" },
    bannerAlt:   { type: String, default: "" },
    isActive:    { type: Boolean, default: true },
    sortOrder:   { type: Number, default: 0 },
    items:       { type: [GalleryItemSchema], default: [] },
  },
  { timestamps: true }
);

GalleryTabSchema.index({ tabKey: 1 });
GalleryTabSchema.index({ sortOrder: 1 });

const GalleryTab: Model<IGalleryTab> =
  mongoose.models.GalleryTab ||
  mongoose.model<IGalleryTab>("GalleryTab", GalleryTabSchema);

export default GalleryTab;