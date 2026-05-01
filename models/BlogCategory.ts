import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBlogCategory extends Document {
  name:        string;
  slug:        string;
  description?: string;
  sortOrder:   number;
  isActive:    boolean;
  createdAt:   Date;
  updatedAt:   Date;
}

const BlogCategorySchema = new Schema<IBlogCategory>(
  {
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    sortOrder:   { type: Number, default: 0 },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

const BlogCategory: Model<IBlogCategory> =
  mongoose.models.BlogCategory ||
  mongoose.model<IBlogCategory>("BlogCategory", BlogCategorySchema);

export default BlogCategory;