import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import AdminUser from "@/models/Admin";
import AdminAuditLog from "@/models/AdminAuditLog";

/**
 * The signed-in admin, resolved from the Auth.js session. The admin JWT only
 * guarantees `sub` (the admin id) — email/name are not stored in it — so this
 * matches on email when present and falls back to the id, the same way
 * getAdminPerms() identifies the admin.
 */
export async function resolveSessionAdmin(): Promise<{ _id: mongoose.Types.ObjectId } | null> {
  const session = await auth();
  const user = session?.user as { email?: string | null; id?: string } | undefined;
  const email = user?.email?.trim().toLowerCase();
  const id = user?.id?.trim();
  const filters: Record<string, unknown>[] = [];
  if (email) filters.push({ email });
  if (id && mongoose.isValidObjectId(id)) filters.push({ _id: id });
  if (filters.length === 0) return null;
  await connectDB();
  return AdminUser.findOne(filters.length === 1 ? filters[0] : { $or: filters }).select("_id").lean<{ _id: mongoose.Types.ObjectId }>();
}

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
    const admin = await resolveSessionAdmin();
    if (!admin) {
      console.error(`logAdminAction skipped for "${action}": no admin identity in the session.`);
      return;
    }

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
