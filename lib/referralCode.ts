import crypto from "crypto";
import User from "@/models/User";

// Excludes ambiguous characters (0/O, 1/I/L) for a human-typeable code.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomSegment(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Generates a unique, human-readable referral code — never derived from email/phone/user id. */
export async function generateUniqueReferralCode(prefix: string, length: number): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `${prefix}-${randomSegment(length)}`;
    const existing = await User.findOne({ referralCode: code }).select("_id").lean();
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique referral code.");
}
