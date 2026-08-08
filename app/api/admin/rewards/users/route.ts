import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q) return NextResponse.json({ users: [] });

    await connectDB();
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({
      $or: [{ name: regex }, { email: regex }, { phone: regex }],
    })
      .select("name email phone damruBalance loyaltyLevel")
      .limit(20)
      .lean();

    return NextResponse.json({ users: JSON.parse(JSON.stringify(users)) });
  } catch (err) {
    console.error("GET admin/rewards/users error:", err);
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
