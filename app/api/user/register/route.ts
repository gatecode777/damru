import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { signUserSession } from "@/lib/userSession";

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password } = await req.json();

    if (!name?.trim())     return NextResponse.json({ error: "Name is required."          }, { status: 400 });
    if (!email?.trim())    return NextResponse.json({ error: "Email is required."         }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
      return NextResponse.json({ error: "Please enter a valid 10-digit phone number." }, { status: 400 });
    }
    if (!password)         return NextResponse.json({ error: "Password is required."      }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password min 6 chars."   }, { status: 400 });

    await connectDB();

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return NextResponse.json({ error: "Email already registered." }, { status: 409 });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || undefined,
      password: hashed,
      status: "active",
    });

    // Set session cookie
    const res = NextResponse.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email },
    });
    return signUserSession(res, { id: user._id.toString(), name: user.name, email: user.email });

  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}