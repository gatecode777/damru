import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import AdminUser from "@/models/Admin";
import AdminAuditLog from "@/models/AdminAuditLog";

/**
 * Records a high-risk admin action for traceability. Call AFTER checkApiPerm
 * has already allowed the request — this never blocks or throws on its own
 * failure, since a logging hiccup must not break the admin action itself.
 */
export async function logAdminAction(
  action: string,
  opts?: { targetType?: string; targetId?: string; details?: Record<string, unknown> }
): Promise<void> {
  try {
    const session = await auth();
    const email = (session?.user as { email?: string } | undefined)?.email;
    if (!email) return;

    await connectDB();
    const admin = await AdminUser.findOne({ email }).select("_id").lean<{ _id: mongoose.Types.ObjectId }>();
    if (!admin) return;

    await AdminAuditLog.create({
      adminId: admin._id,
      action,
      targetType: opts?.targetType,
      targetId: opts?.targetId,
      details: opts?.details,
    });
  } catch (err) {
    console.error(`logAdminAction failed for "${action}":`, err);
  }
}
