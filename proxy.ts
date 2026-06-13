/**
 * proxy.ts — Edge Runtime only.
 * Handles TWO separate auth flows:
 *   1. Admin routes  → protected, redirect to /admin/login if not authed
 *   2. Website "/"   → always public, never redirected
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const SECRET = process.env.AUTH_SECRET || "damru-secret-key";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Admin routes ─────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const isLoginPage = pathname === "/admin/login";

    const isProd = process.env.NODE_ENV === "production";
    const cookieName = isProd ? "__Secure-authjs.session-token" : "authjs.session-token";

    // Decode JWT from cookie — Edge-safe, no DB call
    const token = await getToken({
      req,
      secret: SECRET,
      secureCookie: isProd,
      cookieName,
    });
    const isLoggedIn = !!token;

    // Not logged in + not on login page → send to admin login
    if (!isLoggedIn && !isLoginPage) {
      const url = new URL("/admin/login", req.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    // Already logged in + on login page → send to dashboard
    if (isLoggedIn && isLoginPage) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }

    return NextResponse.next();
  }

  // ── Protected user routes (future — add when user auth ready) ─
  // if (pathname.startsWith("/account") || pathname.startsWith("/orders")) {
  //   const token = await getToken({ req, secret: USER_SECRET });
  //   if (!token) return NextResponse.redirect(new URL("/login", req.url));
  // }

  // ── All website pages → always public ────────────────────────
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    // Add protected user paths here later:
    // "/account/:path*",
    // "/orders/:path*",
  ],
};
