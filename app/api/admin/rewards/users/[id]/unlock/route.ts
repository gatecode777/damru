import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import User from "@/models/User";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const { field } = await req.json();
    if (field !== "dob" && field !== "anniversary") {
      return NextResponse.json({ error: "Invalid field." }, { status: 400 });
    }

    await connectDB();
    const update = field === "dob" ? { dobLocked: false } : { anniversaryLocked: false };
    const user = await User.findByIdAndUpdate(id, update, { new: true }).select("dobLocked anniversaryLocked");
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    await logAdminAction(field === "dob" ? "birthday_unlock" : "anniversary_unlock", { targetType: "User", targetId: id });

    return NextResponse.json({ success: true, dobLocked: user.dobLocked, anniversaryLocked: user.anniversaryLocked });
  } catch (err) {
    console.error("POST admin/rewards/users/[id]/unlock error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
