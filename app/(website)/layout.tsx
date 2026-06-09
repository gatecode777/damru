import type { Metadata } from "next";
import Script from "next/script";
import { getSettings } from "@/lib/getSettings";
import SiteHeader from "@/components/website/SiteHeader";
import SiteFooter from "@/components/website/SiteFooter";
import { CartProvider } from "@/lib/CartContext";

import "@/styles/website/header.css";
import "@/styles/website/style.css";
import "@/styles/website/footer.css";
import "@/styles/website/menu.css";
import "@/styles/website/aboutus.css";
import "@/styles/website/contactus.css";
import "@/styles/website/myprofile.css";
import "@/styles/website/banquet.css";
import "@/styles/website/cart.css";
import "@/styles/website/checkout.css";
import "@/styles/website/gallery.css";
import "@/styles/website/privacypolicy.css";
import "@/styles/website/refundpolicy.css";
import "@/styles/website/shippingpolicy.css";
import "@/styles/website/bookingpolicy.css";
import "@/styles/website/terms.css";
import "@/styles/website/blog.css";
import "@/styles/website/blogdetails.css";
import "@/styles/website/banquetdetail.css";

export const metadata: Metadata = {
  title: {
    default: "Damru By Namo | Restaurant & Banquet, Jaipur",
    template: "%s | Damru By Namo",
  },
  description:
    "Damru By Namo — Jaipur's finest restaurant and banquet hall. Authentic Indian cuisine, corporate events, weddings, and family celebrations across 3 locations.",
  keywords: ["restaurant Jaipur", "banquet hall Jaipur", "Damru By Namo", "Indian food Jaipur"],
  openGraph: {
    title: "Damru By Namo | Restaurant & Banquet, Jaipur",
    description: "Authentic Indian cuisine and banquet services in Jaipur.",
    type: "website",
  },
  icons: {
    icon: "/assets/images/favicon.png",
  },
};

export default async function WebsiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  // Maintenance mode — show message to all website visitors
  if (settings.maintenanceMode) {
    return (
      <html lang="en"><body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: "#fff7ed", fontFamily: "Poppins,sans-serif" }}>
          <img src="/assets/images/damru.png" alt="Damru" style={{ width: 100, marginBottom: 8 }} />
          <h1 style={{ color: "#e67e22", fontSize: "2rem", fontWeight: 700, margin: 0 }}>Under Maintenance</h1>
          <p style={{ color: "#6b7280", fontSize: "1rem", maxWidth: 400, textAlign: "center", margin: 0 }}>{settings.maintenanceMsg || "We'll be back soon!"}</p>
          <p style={{ color: "#aaa", fontSize: "0.85rem" }}>— {settings.siteName} Team</p>
        </div>
      </body></html>
    );
  }

  return (
    <>
      {/* Fonts & icon libraries */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Poppins:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css"
        rel="stylesheet"
      />
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
      />

      {/* Header */}
      <CartProvider>
        <SiteHeader />

        {/* Page content */}
        <div className="damru-theme-wrapper">
          {children}
        </div>

        {/* Footer */}
        <SiteFooter />
      </CartProvider>

      {/* JS for animations (wheel, sliders etc.) */}
      <Script src="/js/main.js" strategy="afterInteractive" />
    </>
  );
}