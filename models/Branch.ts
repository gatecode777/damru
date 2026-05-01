import mongoose, { Schema, Document, Model } from "mongoose";

// ── Hall / Service card inside a branch ──────────────────────────────────────
export interface IHallCard {
  _id?:        string;
  title:       string;               // e.g. "Birthday Party Hall"
  subtitle:    string;               // e.g. "Make Every Birthday Extra Special"
  description: string;               // intro paragraph
  features:    string[];             // bullet list
  perfectFor:  string[];             // second bullet list (optional)
  images:      string[];             // multiple filenames
  sortOrder:   number;
}

const HallCardSchema = new Schema<IHallCard>({
  title:       { type: String, required: true, trim: true },
  subtitle:    { type: String, default: "", trim: true },
  description: { type: String, default: "", trim: true },
  features:    { type: [String], default: [] },
  perfectFor:  { type: [String], default: [] },
  images:      { type: [String], default: [] },
  sortOrder:   { type: Number, default: 0 },
}, { _id: true });

// ── Event type thumbnail ──────────────────────────────────────────────────────
export interface IEventType {
  label: string;
  image: string;
}

const EventTypeSchema = new Schema<IEventType>({
  label: { type: String, required: true, trim: true },
  image: { type: String, default: "" },
}, { _id: false });

// ── Main Branch schema ────────────────────────────────────────────────────────
export interface IBranch extends Document {
  name:        string;               // "Damru By Namo (Mansarovar, Jaipur)"
  slug:        string;               // "mansarovar-jaipur"
  description: string;               // short card description (Our Branches section)
  contact:     string;               // "+91 XXXXX XXXXX"
  timing:      string;               // "11:00 AM – 11:00 PM"
  address:     string;               // full address

  // Banner (top of branch page)
  bannerImage: string;               // filename
  bannerAlt:   string;

  // Card thumbnail (Our Branches section on homepage)
  cardImage:   string;               // filename
  cardAlt:     string;

  // "What We Offer" section
  offerItems:  string[];

  // "Why Choose Damru?" section
  whyChoose:   string;

  // Event type thumbnails row
  eventTypes:  IEventType[];

  // Hall / service cards (Birthday Hall, Multi-Purpose Hall, etc.)
  hallCards:   IHallCard[];

  // Reservation / CTA section
  ctaTitle:    string;
  ctaSubtitle: string;

  isActive:    boolean;
  sortOrder:   number;
  createdAt:   Date;
  updatedAt:   Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", trim: true },
    contact:     { type: String, default: "", trim: true },
    timing:      { type: String, default: "11:00 AM – 11:00 PM", trim: true },
    address:     { type: String, default: "", trim: true },

    bannerImage: { type: String, default: "" },
    bannerAlt:   { type: String, default: "" },
    cardImage:   { type: String, default: "" },
    cardAlt:     { type: String, default: "" },

    offerItems:  { type: [String], default: [] },
    whyChoose:   { type: String, default: "" },
    eventTypes:  { type: [EventTypeSchema], default: [] },
    hallCards:   { type: [HallCardSchema],  default: [] },

    ctaTitle:    { type: String, default: "Plan Your Special Event" },
    ctaSubtitle: { type: String, default: "Fill in your details and let us make your celebration truly special." },

    isActive:  { type: Boolean, default: true },
    sortOrder: { type: Number,  default: 0 },
  },
  { timestamps: true }
);

const Branch: Model<IBranch> =
  mongoose.models.Branch || mongoose.model<IBranch>("Branch", BranchSchema);

export default Branch;