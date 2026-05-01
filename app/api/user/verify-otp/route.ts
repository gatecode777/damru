import { NextRequest, NextResponse } from "next/server";
import { verifyOtpToken, signResetToken } from "@/lib/otp";

export async function POST(req: NextRequest) {
  try {
    const { otpToken, otp } = await req.json();

    if (!otpToken || !otp)
      return NextResponse.json({ error: "OTP token and code required." }, { status: 400 });

    const digits = String(otp).trim();
    if (digits.length !== 6)
      return NextResponse.json({ error: "Enter all 6 digits." }, { status: 400 });

    // Will throw if expired or invalid
    const email = verifyOtpToken(otpToken, digits);

    // Issue a short-lived reset token
    const resetToken = signResetToken(email);

    return NextResponse.json({ success: true, resetToken, email });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid or expired OTP.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}