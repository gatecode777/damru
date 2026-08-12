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

/**
 * Call from a server component to get the current admin's permissions.
 * Route handlers that already resolved a session should pass its email so we
 * do not perform a second Auth.js lookup in the same request.
 */
export async function getAdminPerms(authenticatedEmail?: string | null, authenticatedId?: string | null): Promise<AdminPerms> {
  let email = authenticatedEmail?.trim().toLowerCase();
  let adminId = authenticatedId?.trim();
  if (!email) {
    const session = await auth();
    email = session?.user?.email?.trim().toLowerCase();
    adminId = (session?.user as { id?: string } | undefined)?.id?.trim();
  }

  if (!email && !adminId) {
    // Unauthenticated — no access
    const none = () => false;
    return { name: "Admin", email: "", role:"moderator", isSuperAdmin:false, can:none, permissions:{} };
  }

  await connectDB();
  const identityFilters: Array<{ email: string } | { _id: string }> = [];
  if (email) identityFilters.push({ email });
  if (adminId) identityFilters.push({ _id: adminId });
  const admin = await AdminUser.findOne(
    identityFilters.length === 1 ? identityFilters[0] : { $or: identityFilters },
  ).select("name email role permissions isActive isSuperAdmin").lean<{
    name?: string;
    email?: string;
    role: "super_admin" | "admin" | "moderator";
    permissions?: AdminPerms["permissions"];
    isActive?: boolean;
    isSuperAdmin?: boolean;
  }>();

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
    cleanPermissions[key] = {
      view:   Boolean(val.view),
      create: Boolean(val.create),
      edit:   Boolean(val.edit),
      delete: Boolean(val.delete),
    };
  }
  return {
    name:         p.name || "Admin",
    email:        p.email || "",
    role:         p.role,
    isSuperAdmin: p.isSuperAdmin,
    permissions:  cleanPermissions,
  };
}
