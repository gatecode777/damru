/**
 * auth.ts — Node.js runtime ONLY. Never imported by middleware.ts.
 *
 * pages.signIn is set here so NextAuth knows where the custom login form is.
 * This is safe because auth.ts is NEVER imported by middleware.ts —
 * middleware.ts only imports auth.config.ts which has NO pages.signIn.
 * The previous bug was having pages.signIn in auth.config.ts (used by middleware).
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { connectDB } from "@/lib/mongodb";
import AdminUser from "@/models/Admin";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  // Tell NextAuth where our custom login form lives.
  // This stops it from falling back to /api/auth/signin (the ugly built-in form).
  pages: {
    signIn: "/admin/login",
  },

  providers: [
    Credentials({
      // id must match what loginAction passes: signIn("credentials", ...)
      id:   "credentials",
      name: "Admin",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          await connectDB();
          const admin = await AdminUser.findOne({
            email: (credentials.email as string).toLowerCase(),
          }).select("+password isActive").lean();
          if (!admin) return null;
          if (admin.isActive === false) return null;

          const stored = admin.password as string;
          const valid  = stored.startsWith("$2")
            ? await bcrypt.compare(credentials.password as string, stored)
            : stored === credentials.password;

          if (!valid) return null;

          return {
            id:    (admin._id as { toString(): string }).toString(),
            name:  admin.name  as string,
            email: admin.email as string,
            role:  admin.role  as string,
          };
        } catch (err) {
          console.error("Admin auth error:", err);
          return null;
        }
      },
    }),
  ],
});