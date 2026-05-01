import mongoose, { Schema, Document, Model } from "mongoose";
import "./BlogCategory"; // ensure model is registered

// ── Content block (rich structured content) ──────────────────
export type BlockType =
  | "paragraph" | "heading" | "subheading"
  | "bullet_list" | "numbered_list"
  | "quote" | "callout" | "image" | "table" | "divider";

export interface IContentBlock {
  type:          BlockType;
  text?:         string;
  items?:        string[];
  imageFile?:    string;   // filename in /uploads/blogs/
  imageAlt?:     string;
  imageCaption?: string;
  tableHeaders?: string[];
  tableRows?:    string[][];
}

const ContentBlockSchema = new Schema<IContentBlock>(
  {
    type:          { type: String, enum: ["paragraph","heading","subheading","bullet_list","numbered_list","quote","callout","image","table","divider"], required: true },
    text:          { type: String, default: "" },
    items:         [{ type: String }],
    imageFile:     { type: String, default: "" },
    imageAlt:      { type: String, default: "" },
    imageCaption:  { type: String, default: "" },
    tableHeaders:  [{ type: String }],
    tableRows:     [[{ type: String }]],
  },
  { _id: false }
);

// ── SEO sub-schema ────────────────────────────────────────────
export interface ISeo {
  metaTitle:       string;
  metaDescription: string;
  metaKeywords:    string;
}

const SeoSchema = new Schema<ISeo>(
  {
    metaTitle:       { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    metaKeywords:    { type: String, default: "" },
  },
  { _id: false }
);

// ── Author sub-schema ─────────────────────────────────────────
export interface IAuthor {
  name:        string;
  image:       string;
  designation: string;
  bio:         string;
}

const AuthorSchema = new Schema<IAuthor>(
  {
    name:        { type: String, default: "Damru Team" },
    image:       { type: String, default: "" },
    designation: { type: String, default: "" },
    bio:         { type: String, default: "" },
  },
  { _id: false }
);

// ── Main Blog schema ──────────────────────────────────────────
export type BlogStatus = "draft" | "published" | "archived";

export interface IBlog extends Document {
  title:         string;
  slug:          string;
  excerpt:       string;
  coverImage:    string;
  coverImageAlt: string;
  content:       IContentBlock[];
  category:      mongoose.Types.ObjectId | null;
  tags:          string[];
  author:        IAuthor;
  status:        BlogStatus;
  isFeatured:    boolean;
  views:         number;
  readTime:      number;
  sortOrder:     number;
  publishedAt?:  Date;
  seo:           ISeo;
  createdAt:     Date;
  updatedAt:     Date;
}

const BlogSchema = new Schema<IBlog>(
  {
    title:         { type: String, required: true, trim: true },
    slug:          { type: String, unique: true, lowercase: true, trim: true },
    excerpt:       { type: String, trim: true, default: "" },
    coverImage:    { type: String, default: "" },
    coverImageAlt: { type: String, default: "" },
    content:       { type: [ContentBlockSchema], default: [] },
    category:      { type: Schema.Types.ObjectId, ref: "BlogCategory", default: null },
    tags:          { type: [String], default: [] },
    author:        { type: AuthorSchema, default: () => ({}) },
    status:        { type: String, enum: ["draft","published","archived"], default: "draft" },
    isFeatured:    { type: Boolean, default: false },
    views:         { type: Number, default: 0 },
    readTime:      { type: Number, default: 1 },
    sortOrder:     { type: Number, default: 0 },
    publishedAt:   { type: Date },
    seo:           { type: SeoSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Indexes
BlogSchema.index({ slug: 1 });
BlogSchema.index({ status: 1 });
BlogSchema.index({ isFeatured: 1 });
BlogSchema.index({ publishedAt: -1 });
BlogSchema.index({ tags: 1 });

// Use async pre-save — no `next` parameter needed in Mongoose 7+
BlogSchema.pre("save", async function () {
  // Auto slug
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
  // publishedAt
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  // Auto read time from content
  if (this.isModified("content")) {
    const words = this.content.reduce((total: number, block: IContentBlock) => {
      const text = block.text || (block.items || []).join(" ");
      return total + text.split(/\s+/).filter(Boolean).length;
    }, 0);
    this.readTime = Math.max(1, Math.ceil(words / 200));
  }
});

const Blog: Model<IBlog> =
  mongoose.models.Blog || mongoose.model<IBlog>("Blog", BlogSchema);

export default Blog;