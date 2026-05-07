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
    ],
  },
};

export default nextConfig;