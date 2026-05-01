import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAdmin extends Document {
  name: string;
  email: string;
  password: string;
  role: "super_admin" | "admin" | "editor";
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new Schema<IAdmin>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["super_admin", "admin", "editor"],
      default: "admin",
    },
    avatar: { type: String },
  },
  { timestamps: true }
);

const Admin: Model<IAdmin> =
  mongoose.models.Admin ||
  mongoose.model<IAdmin>("Admin", AdminSchema);

export default Admin;
