import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyResetToken } from "@/lib/otp";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const { resetToken, password } = await req.json();

    if (!resetToken || !password)
      return NextResponse.json({ error: "Reset token and password required." }, { status: 400 });

    if (password.length < 6)
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });

    // Will throw if expired / invalid
    const email = verifyResetToken(resetToken);

    await connectDB();
    const hashed = await bcrypt.hash(password, 10);
    const updated = await User.findOneAndUpdate(
      { email },
      { password: hashed },
      { new: true }
    );

    if (!updated)
      return NextResponse.json({ error: "User not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Password reset successfully." });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reset failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}