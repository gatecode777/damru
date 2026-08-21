import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminPerms } from "@/lib/adminPermissions";

type Action = "view" | "create" | "edit" | "delete";

/** Returns null when the signed-in admin may perform the requested action. */
export async function checkApiPerm(module: string, action: Action = "view"): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized", code: "SESSION_EXPIRED" }, { status: 401 });
  }

  const perms = await getAdminPerms(
    session.user.email,
    (session.user as { id?: string }).id,
  );

  // getAdminPerms intentionally returns an empty identity for missing or
  // inactive accounts. Never treat its fallback role as a real moderator.
  if (!perms.email) {
    return NextResponse.json({ error: "Admin account is unavailable.", code: "ADMIN_ACCOUNT_UNAVAILABLE" }, { status: 403 });
  }

  if (!perms.can(module, action)) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  return null;
}
