import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import AdminUser from "@/models/Admin";

export interface AdminPerms {
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
    return { role:"moderator", isSuperAdmin:false, can:none, permissions:{} };
  }

  await connectDB();
  const admin = await AdminUser.findOne({
    email: (session.user as any).email,
  }).select("role permissions isActive").lean() as any;

  if (!admin) {
    const none = () => false;
    return { role:"moderator", isSuperAdmin:false, can:none, permissions:{} };
  }

  const isSuperAdmin = admin.role === "super_admin" || admin.role === "admin";
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