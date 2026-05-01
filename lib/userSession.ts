import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export const USER_COOKIE  = "damru_user_session";
const JWT_SECRET          = process.env.JWT_SECRET || "damru-otp-secret";
const SESSION_EXPIRY_DAYS = 7;

interface UserPayload {
  id:      string;
  name:    string;
  email:   string;
  avatar?: string;
}

/** Sign a JWT and attach it as an httpOnly cookie */
export function signUserSession(res: NextResponse, user: UserPayload): NextResponse {
  const token = jwt.sign(
    { ...user, purpose: "user-session" },
    JWT_SECRET,
    { expiresIn: `${SESSION_EXPIRY_DAYS}d` }
  );

  res.cookies.set(USER_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    path:     "/",
  });

  return res;
}

/** Read and verify the user session cookie from a request */
export function getUserFromCookie(req: NextRequest): UserPayload | null {
  try {
    const token = req.cookies.get(USER_COOKIE)?.value;
    if (!token) return null;

    const payload = jwt.verify(token, JWT_SECRET) as UserPayload & { purpose: string };
    if (payload.purpose !== "user-session") return null;

    return { id: payload.id, name: payload.name, email: payload.email, avatar: payload.avatar };
  } catch {
    return null;
  }
}