import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  status: "active" | "inactive" | "suspended";
  totalSpend: number;
  avatar?: string;
  loginTokens?: string[]; // For session management (optional)
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    totalSpend: { type: Number, default: 0 },
    avatar: { type: String },
    loginTokens: { type: [String] },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
