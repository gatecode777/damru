import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const perms = await getAdminPerms();
    const serializedPerms = serializePerms(perms);

    return NextResponse.json(serializedPerms);
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}