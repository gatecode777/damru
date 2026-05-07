import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPermissionModule {
  view:   boolean;
  create: boolean;
  edit:   boolean;
  delete: boolean;
}

export interface IAdminPermissions {
  dashboard:      IPermissionModule;
  users:          IPermissionModule;
  orders:         IPermissionModule;
  reservations:   IPermissionModule;
  complaints:     IPermissionModule;
  categories:     IPermissionModule;
  menu:           IPermissionModule;
  blogs:          IPermissionModule;
  blogCategories: IPermissionModule;
  gallery:        IPermissionModule;
  branches:       IPermissionModule;
  banquetBookings:IPermissionModule;
  coupons:        IPermissionModule;
  analytics:      IPermissionModule;
  settings:       IPermissionModule;
}

export interface IAdmin extends Document {
  name:        string;
  email:       string;
  password:    string;
  role:        "super_admin" | "admin" | "moderator";
  avatar?:     string;
  isActive:    boolean;
  permissions: IAdminPermissions;
  createdBy?:  mongoose.Types.ObjectId;
  lastLogin?:  Date;
  createdAt:   Date;
  updatedAt:   Date;
}

const permModule = {
  view:   { type: Boolean, default: false },
  create: { type: Boolean, default: false },
  edit:   { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
};

const AdminSchema = new Schema<IAdmin>(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role:     { type: String, enum: ["super_admin", "admin", "moderator"], default: "admin" },
    avatar:   { type: String },
    isActive: { type: Boolean, default: true },
    permissions: {
      dashboard:      { type: permModule, default: () => ({ view: true,  create: false, edit: false, delete: false }) },
      users:          { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      orders:         { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      reservations:   { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      complaints:     { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      categories:     { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      menu:           { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      blogs:          { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      blogCategories: { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      gallery:        { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      branches:       { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      banquetBookings:{ type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      coupons:        { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      analytics:      { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
      // settings:       { type: permModule, default: () => ({ view: false, create: false, edit: false, delete: false }) },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

const Admin: Model<IAdmin> =
  mongoose.models.Admin ||
  mongoose.model<IAdmin>("Admin", AdminSchema);

export default Admin;