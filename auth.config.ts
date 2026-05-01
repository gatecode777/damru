import type { NextAuthConfig } from "next-auth";

/**
 * auth.config.ts — Edge Runtime safe.
 * NO mongoose, bcrypt, or Node.js-only modules here.
 * Used ONLY by middleware.ts for lightweight session checking.
 *
 * NOTE: No `pages.signIn` here — that caused "/" to redirect to admin login.
 * Route protection is handled manually in middleware.ts below.
 */
export const authConfig: NextAuthConfig = {
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = token.role as string;
      return session;
    },
  },
  providers: [], // Credentials provider added in auth.ts (Node.js runtime)
  secret: process.env.AUTH_SECRET || "damru-secret-key",
};