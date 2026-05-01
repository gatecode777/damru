import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBlogComment extends Document {
  blogId:    mongoose.Types.ObjectId;
  blogSlug:  string;
  userId?:   string;
  name:      string;
  email:     string;
  avatar?:   string;
  comment:   string;
  parentId?: mongoose.Types.ObjectId | null; // null = top-level, set = reply
  approved:  boolean;
  createdAt: Date;
}

const BlogCommentSchema = new Schema<IBlogComment>(
  {
    blogId:   { type: Schema.Types.ObjectId, ref: "Blog", required: true, index: true },
    blogSlug: { type: String, required: true, index: true },
    userId:   { type: String, default: "" },
    name:     { type: String, required: true, trim: true, maxlength: 80 },
    email:    { type: String, required: true, trim: true, lowercase: true },
    avatar:   { type: String, default: "" },
    comment:  { type: String, required: true, trim: true, maxlength: 2000 },
    parentId: { type: Schema.Types.ObjectId, ref: "BlogComment", default: null },
    approved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const BlogComment: Model<IBlogComment> =
  mongoose.models.BlogComment ||
  mongoose.model<IBlogComment>("BlogComment", BlogCommentSchema);

export default BlogComment;