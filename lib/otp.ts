import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getJwtSecret } from "@/lib/env";

const OTP_EXPIRY_MINUTES = 10;

/** Generate a 6-digit OTP */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/** Sign an OTP into a short-lived JWT */
export function signOtpToken(email: string, otp: string): string {
  return jwt.sign(
    { email: email.toLowerCase(), otp, purpose: "user-otp" },
    getJwtSecret(),
    { expiresIn: `${OTP_EXPIRY_MINUTES}m` }
  );
}

/** Verify an OTP token — returns email if valid, throws otherwise */
export function verifyOtpToken(token: string, submittedOtp: string): string {
  const payload = jwt.verify(token, getJwtSecret()) as {
    email: string;
    otp:   string;
    purpose: string;
  };
  if (payload.purpose !== "user-otp") throw new Error("Invalid token purpose");
  if (payload.otp !== submittedOtp)   throw new Error("OTP does not match");
  return payload.email;
}

/** Sign a short-lived reset token (after OTP verified) */
export function signResetToken(email: string): string {
  return jwt.sign(
    { email: email.toLowerCase(), purpose: "password-reset" },
    getJwtSecret(),
    { expiresIn: "15m" }
  );
}

/** Verify a reset token */
export function verifyResetToken(token: string): string {
  const payload = jwt.verify(token, getJwtSecret()) as { email: string; purpose: string };
  if (payload.purpose !== "password-reset") throw new Error("Invalid token");
  return payload.email;
}
