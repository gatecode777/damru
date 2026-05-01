import mongoose, { Schema, Document, Model } from "mongoose";

export type VariantType = "none" | "portion" | "weight" | "pound" | "addon" | "custom";

export interface IVariantOption {
  label: string;
  price: number;
}

export interface IMenuItem extends Document {
  name:        string;
  slug:        string;
  category:    mongoose.Types.ObjectId;
  description: string;
  image?:      string;
  basePrice:   number;
  variantType: VariantType;
  variants:    IVariantOption[];
  isVeg:       boolean;
  isActive:    boolean;
  isFeatured:  boolean;
  sortOrder:   number;
  tags:        string[];
  createdAt:   Date;
  updatedAt:   Date;
}

const VariantOptionSchema = new Schema<IVariantOption>(
  {
    label: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const MenuItemSchema = new Schema<IMenuItem>(
  {
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    category:    { type: Schema.Types.ObjectId, ref: "Category", required: true },
    description: { type: String, trim: true, default: "" },
    image:       { type: String },
    basePrice:   { type: Number, default: 0, min: 0 },
    variantType: {
      type:    String,
      enum:    ["none", "portion", "weight", "pound", "addon", "custom"],
      default: "none",
    },
    variants:   { type: [VariantOptionSchema], default: [] },
    isVeg:      { type: Boolean, default: true },
    isActive:   { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    sortOrder:  { type: Number, default: 0 },
    tags:       { type: [String], default: [] },
  },
  { timestamps: true }
);

// Auto-generate slug from name — using "save" hook (mongoose 9 compatible)
MenuItemSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
});

const MenuItem: Model<IMenuItem> =
  mongoose.models.MenuItem ||
  mongoose.model<IMenuItem>("MenuItem", MenuItemSchema);

export default MenuItem;