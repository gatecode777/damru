import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import AdminUser from "@/models/Admin";

type Action = "view" | "create" | "edit" | "delete";

/**
 * Use at the top of API route handlers to enforce permissions.
 * Returns null if allowed, or a 401/403 NextResponse if blocked.
 *
 * Usage:
 *   const deny = await checkApiPerm("users", "delete");
 *   if (deny) return deny;
 */
export async function checkApiPerm(module: string, action: Action = "view"): Promise<NextResponse | null> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const admin = await AdminUser.findOne({
    email: (session.user as any).email,
  }).select("role permissions isActive").lean() as any;

  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role === "super_admin") return null; // always allowed

  const allowed = Boolean(admin.permissions?.[module]?.[action]);
  if (!allowed) return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });

  return null;
}