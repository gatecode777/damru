import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Damru By Namo",
    template: "%s | Damru By Namo",
  },
  description: "Damru By Namo — Restaurant & Banquet Hall, Jaipur",
  icons: {
    icon: "/assets/images/favicon.png",
  },
};

// ── This is what makes responsive / media queries work on mobile ──
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
