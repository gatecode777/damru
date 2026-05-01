import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { generateOtp, signOtpToken } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase() });
    // Don't reveal if email exists — always return success
    if (!user) {
      return NextResponse.json({ success: true, message: "If that email exists, an OTP has been sent." });
    }

    const otp   = generateOtp();
    const token = signOtpToken(email.toLowerCase(), otp);

    await sendOtpEmail(email, otp, user.name);

    // Return token in response so client can include it in verify step
    return NextResponse.json({
      success: true,
      otpToken: token,
      message: "OTP sent to your email.",
    });

  } catch (err) {
    console.error("Send OTP error:", err);
    return NextResponse.json({ error: "Failed to send OTP." }, { status: 500 });
  }
}