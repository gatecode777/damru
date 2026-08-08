import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Minimal, append-only trail for high-risk admin actions that don't already
 * carry attribution elsewhere (Damru credit/debit already record `adjustedBy`
 * on DamruTransaction — this is for the actions that had no record at all:
 * occasion unlocks, reward-rule/referral-config/loyalty-config edits,
 * permission changes). Not a general logging platform — just who did what,
 * to what, and when.
 */
export interface IAdminAuditLog extends Document {
  adminId: mongoose.Types.ObjectId;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: String },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ action: 1, createdAt: -1 });

const AdminAuditLog: Model<IAdminAuditLog> =
  mongoose.models.AdminAuditLog || mongoose.model<IAdminAuditLog>("AdminAuditLog", AdminAuditLogSchema);

export default AdminAuditLog;
