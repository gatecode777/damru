import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offers | Damru By Namo",
  description: "Exciting deals and discounts coming soon to Damru By Namo restaurant and banquet in Jaipur.",
  keywords: ["damru offers", "restaurant coupons jaipur", "banquet discounts jaipur", "food offers jaipur"],
};

export default function OffersPage() {
  return (
    <div style={{
      minHeight: "80vh",
      background: "#fffdf9",
      fontFamily: "Poppins, sans-serif",
      color: "#333",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 20px",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Decorative background vectors or shapes */}
      <div style={{
        position: "absolute",
        top: "-10%",
        right: "-10%",
        width: "350px",
        height: "350px",
        borderRadius: "50%",
        background: "rgba(230, 126, 34, 0.05)",
        filter: "blur(50px)",
        pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute",
        bottom: "-10%",
        left: "-10%",
        width: "400px",
        height: "400px",
        borderRadius: "50%",
        background: "rgba(74, 92, 42, 0.05)",
        filter: "blur(60px)",
        pointerEvents: "none"
      }} />

      {/* Main card content */}
      <div style={{
        maxWidth: "600px",
        textAlign: "center",
        zIndex: 2,
        background: "#ffffff",
        padding: "50px 40px",
        borderRadius: "24px",
        boxShadow: "0 10px 40px rgba(230, 126, 34, 0.06)",
        border: "1px solid rgba(230, 126, 34, 0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        {/* Animated Icon Container */}
        <div style={{
          width: "80px",
          height: "80px",
          background: "linear-gradient(135deg, #fff3e6, #ffe5cc)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
          boxShadow: "0 8px 20px rgba(230, 126, 34, 0.15)"
        }}>
          <i className="ri-percent-line" style={{
            fontSize: "2.5rem",
            color: "#e67e22"
          }} />
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "2.8rem",
          fontWeight: 700,
          color: "#2d3621",
          margin: "0 0 16px 0",
          lineHeight: "1.2"
        }}>
          Exciting Offers
        </h1>

        {/* Subtitle / Coming Soon badge */}
        <div style={{
          display: "inline-block",
          background: "linear-gradient(90deg, #e67e22, #f39c12)",
          color: "#fff",
          fontSize: "0.85rem",
          fontWeight: 600,
          padding: "6px 20px",
          borderRadius: "50px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: "20px",
          boxShadow: "0 4px 10px rgba(230, 126, 34, 0.2)"
        }}>
          Coming Soon
        </div>

        {/* Description */}
        <p style={{
          fontSize: "1rem",
          lineHeight: "1.6",
          color: "#6b7280",
          margin: "0 0 32px 0",
          maxWidth: "480px"
        }}>
          We are crafting some delicious deals, exclusive event discounts, and dining rewards just for you. Keep an eye on this space to grab them first!
        </p>

        {/* Buttons */}
        <div style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          justifyContent: "center"
        }}>
          <Link href="/menu" style={{
            background: "#2d3621",
            color: "#fff",
            fontWeight: 500,
            fontSize: "0.95rem",
            padding: "12px 30px",
            borderRadius: "30px",
            textDecoration: "none",
            transition: "all 0.2s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(45, 54, 33, 0.15)"
          }}>
            Explore Our Menu
          </Link>
          <Link href="/" style={{
            background: "transparent",
            color: "#e67e22",
            border: "1.5px solid #e67e22",
            fontWeight: 500,
            fontSize: "0.95rem",
            padding: "10px 28px",
            borderRadius: "30px",
            textDecoration: "none",
            transition: "all 0.2s ease"
          }}>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
