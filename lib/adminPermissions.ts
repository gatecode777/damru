import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import AdminUser from "@/models/Admin";

/**
 * Shared admin-bypass predicate (also used by checkApiPerm.ts). `super_admin`
 * always bypasses. `admin` bypasses too UNLESS `isSuperAdmin` was explicitly
 * stored as `false` — accounts created before that flag existed have no
 * stored value (`undefined !== false`) and keep full access, so existing
 * production admins are never silently downgraded.
 */
export function adminBypassesPermissions(role: string, isSuperAdmin: boolean | undefined): boolean {
  if (role === "super_admin") return true;
  return role === "admin" && isSuperAdmin !== false;
}

export interface AdminPerms {
  name?: string;
  email?: string;
  role: "super_admin" | "admin" | "moderator";
  isSuperAdmin: boolean;
  can: (module: string, action?: "view"|"create"|"edit"|"delete") => boolean;
  permissions: Record<string, { view:boolean; create:boolean; edit:boolean; delete:boolean }>;
}

/** Call from any server component to get the current admin's permissions */
export async function getAdminPerms(): Promise<AdminPerms> {
  const session = await auth();
  if (!session?.user) {
    // Unauthenticated — no access
    const none = () => false;
    return { name: "Admin", email: "", role:"moderator", isSuperAdmin:false, can:none, permissions:{} };
  }

  await connectDB();
  const admin = await AdminUser.findOne({
    email: (session.user as any).email,
  }).select("role permissions isActive isSuperAdmin").lean() as any;

  if (!admin || admin.isActive === false) {
    const none = () => false;
    return { role:"moderator", isSuperAdmin:false, can:none, permissions:{} };
  }

  const isSuperAdmin = adminBypassesPermissions(admin.role, admin.isSuperAdmin);
  const permissions  = admin.permissions || {};

  const can = (module: string, action: "view"|"create"|"edit"|"delete" = "view"): boolean => {
    if (isSuperAdmin) return true;
    return Boolean(permissions[module]?.[action]);
  };

  return { name: admin.name || "Admin", email: admin.email || "", role: admin.role, isSuperAdmin, can, permissions };
}

/** Serialisable version to pass as props to client components.
 *  Strips MongoDB ObjectId _id fields from permission sub-documents. */
export function serializePerms(p: AdminPerms) {
  // Each permission module comes from Mongoose with an _id ObjectId — strip it
  const cleanPermissions: Record<string, { view:boolean; create:boolean; edit:boolean; delete:boolean }> = {};
  for (const [key, val] of Object.entries(p.permissions || {})) {
    const { _id, ...rest } = val as any;
    cleanPermissions[key] = {
      view:   Boolean(rest.view),
      create: Boolean(rest.create),
      edit:   Boolean(rest.edit),
      delete: Boolean(rest.delete),
    };
  }
  return {
    name:         (p as any).name || "Admin",
    email:        (p as any).email || "",
    role:         p.role,
    isSuperAdmin: p.isSuperAdmin,
    permissions:  cleanPermissions,
  };
}