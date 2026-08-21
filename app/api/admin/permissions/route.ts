import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "SESSION_EXPIRED" }, { status: 401 });
    }

    const perms = await getAdminPerms(
      session.user?.email,
      (session.user as { id?: string } | undefined)?.id,
    );
    const serializedPerms = serializePerms(perms);

    return NextResponse.json(serializedPerms, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
