import type { Metadata } from "next";

// ── ALL admin CSS in one place — same rule as website layout ──────────────────
// CSS imported in individual pages/components can fail to load on navigation.
// Loading everything here guarantees styles are always present.
import "@/styles/admin/table.css";
import "@/styles/admin/category.css";
import "@/styles/admin/form.css";
import "@/styles/admin/user-form.css";
import "@/styles/admin/users.css";
import "@/styles/admin/menu.css";
import "@/styles/admin/menu-form.css";
import "@/styles/admin/blog-form.css";
import "@/styles/admin/category.css";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | Damru Admin",
  },
  description: "Damru Admin Panel",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Admin fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap"
        rel="stylesheet"
      />

      <style>{`
        body {
          background: #f5f6fa;
          color: #111827;
          font-family: 'DM Sans', sans-serif;
        }
        :root {
          --brand: #f97316; --brand-dark: #ea580c;
          --brand-light: #fff7ed; --brand-mid: #fed7aa;
          --sidebar-w: 240px; --header-h: 60px;
          --bg: #f5f6fa; --surface: #ffffff; --surface2: #f9fafb;
          --border: #e5e7eb; --border-light: #f3f4f6;
          --text: #111827; --text-2: #4b5563; --text-3: #9ca3af;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
          --shadow: 0 4px 12px rgba(0,0,0,0.06);
          --shadow-lg: 0 12px 32px rgba(0,0,0,0.08);
          --radius: 12px; --radius-sm: 8px;
        }
      `}</style>

      {children}
    </>
  );
}