import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout — intentionally minimal.
 * This wraps BOTH the website and the admin panel.
 *
 * Website fonts/styles → app/(website)/layout.tsx
 * Admin fonts/styles   → app/admin/layout.tsx
 */
export const metadata: Metadata = {
  title: {
    default: "Damru By Namo",
    template: "%s | Damru By Namo",
  },
  description: "Damru By Namo — Restaurant & Banquet Hall, Jaipur",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}