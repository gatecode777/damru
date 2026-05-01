import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { signUserSession } from "@/lib/userSession";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password)
      return NextResponse.json({ error: "Email and password required." }, { status: 400 });

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

    if (user.status === "suspended")
      return NextResponse.json({ error: "Account suspended. Contact support." }, { status: 403 });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

    const res = NextResponse.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar },
    });
    return signUserSession(res, {
      id:     user._id.toString(),
      name:   user.name,
      email:  user.email,
      avatar: user.avatar,
    });

  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}