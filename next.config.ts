import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for instrumentation.ts to work with Turbopack in Next.js 15
  experimental: {
    // This is NOT the same as the old instrumentationHook flag.
    // In Next.js 15 with Turbopack, you must explicitly allow the
    // Node.js instrumentation file to run.
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "cdn-icons-png.flaticon.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "ik.imagekit.io" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/offer",
        destination: "/offers",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Baseline hardening only — no CSP here. This app serves third-party
    // images (Unsplash, ImageKit, Google avatars) and will add a payment
    // gateway later; a strict script/connect CSP needs an audit of every
    // external origin first, so it's tracked as deferred work rather than
    // guessed at here. HSTS is limited to production, where Vercel/HTTPS
    // termination is a safe assumption — sending it in local dev would
    // wrongly force HTTPS on http://localhost.
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
        : []),
    ];
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;