import { NextRequest, NextResponse } from "next/server";

const AUTH_SESSION_COOKIE_PREFIXES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export async function GET(req: NextRequest) {
  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("reason", "session_expired");
  const response = NextResponse.redirect(loginUrl);

  // Auth.js may split a large encrypted JWT into numbered cookie chunks.
  // Delete every matching cookie supplied by this browser, not only `.0`.
  for (const cookie of req.cookies.getAll()) {
    if (AUTH_SESSION_COOKIE_PREFIXES.some((prefix) => cookie.name === prefix || cookie.name.startsWith(`${prefix}.`))) {
      response.cookies.delete(cookie.name);
    }
  }

  return response;
}
