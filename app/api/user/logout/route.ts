import { NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/userSession";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}