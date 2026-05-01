import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import CouponsClient from "./CouponsClient";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  let coupons: {
    _id: string; code: string; description: string; type: string;
    value: number; maxDiscount: number | null; minOrderValue: number;
    usageLimit: number | null; usedCount: number; perUserLimit: number;
    startDate: string; expiryDate: string | null;
    isActive: boolean; createdAt: string;
  }[] = [];

  try {
    await connectDB();
    const raw = await Coupon.find().sort({ createdAt: -1 });
    coupons = JSON.parse(JSON.stringify(raw));
  } catch { /* empty */ }

  const now         = new Date();
  const active      = coupons.filter(c => c.isActive && (!c.expiryDate || new Date(c.expiryDate) > now) && (c.usageLimit === null || c.usedCount < c.usageLimit)).length;
  const expired     = coupons.filter(c => c.expiryDate && new Date(c.expiryDate) <= now).length;
  const exhausted   = coupons.filter(c => c.usageLimit !== null && c.usedCount >= c.usageLimit).length;

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Coupons" />
        <main className="page-main">

          <div className="page-header">
            <div>
              <h2 className="page-title">Coupons</h2>
              <p className="page-sub">{coupons.length} coupons · {active} active</p>
            </div>
          </div>

          {/* Stats */}
          <div className="menu-stats">
            {[
              { label: "Total",     value: coupons.length, color: "#f97316" },
              { label: "Active",    value: active,         color: "#16a34a" },
              { label: "Expired",   value: expired,        color: "#6b7280" },
              { label: "Exhausted", value: exhausted,      color: "#dc2626" },
            ].map(s => (
              <div key={s.label} className="menu-stat">
                <span className="ms-value" style={{ color: s.color }}>{s.value}</span>
                <span className="ms-label">{s.label}</span>
              </div>
            ))}
          </div>

          <CouponsClient coupons={coupons} />

        </main>
      </div>
    </>
  );
}