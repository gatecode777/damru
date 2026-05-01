import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";
import OrdersClient from "./OrdersClient";

export const metadata = { title: "Orders" };

export type OrderRow = {
  _id: string; orderId: string;
  userName: string; userEmail: string; userPhone: string;
  itemCount: number; total: number;
  paymentMethod: string; paymentStatus: string; status: string;
  couponCode: string; discount: number;
  createdAt: string;
};

export default async function OrdersPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  let orders: OrderRow[] = [];

  try {
    await connectDB();
    const raw = await Order.find()
      .sort({ createdAt: -1 })
      .select("orderId userName userEmail userPhone items total paymentMethod paymentStatus status couponCode discount createdAt")
      .lean();

    orders = raw.map((o: any) => ({
      _id:           String(o._id),
      orderId:       o.orderId,
      userName:      o.userName,
      userEmail:     o.userEmail,
      userPhone:     o.userPhone || "",
      itemCount:     o.items?.length ?? 0,
      total:         o.total,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      status:        o.status,
      couponCode:    o.couponCode || "",
      discount:      o.discount || 0,
      createdAt:     String(o.createdAt),
    }));
  } catch { /* empty on first run */ }

  const now   = new Date();
  const today = orders.filter(o => new Date(o.createdAt).toDateString() === now.toDateString()).length;

  const stats = {
    total:      orders.length,
    today,
    pending:    orders.filter(o => o.status === "pending").length,
    confirmed:  orders.filter(o => o.status === "confirmed").length,
    preparing:  orders.filter(o => o.status === "preparing").length,
    delivering: orders.filter(o => o.status === "out_for_delivery").length,
    delivered:  orders.filter(o => o.status === "delivered").length,
    cancelled:  orders.filter(o => o.status === "cancelled").length,
    revenue:    orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total, 0),
  };

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Orders" />
        <main className="page-main">

          <div className="page-header">
            <div>
              <h2 className="page-title">Orders</h2>
              <p className="page-sub">{orders.length} total · {stats.today} today</p>
            </div>
          </div>

          {/* Stats */}
          <div className="menu-stats">
            {[
              { label: "Total",       value: stats.total,      color: "#f97316" },
              { label: "Revenue",     value: `₹${stats.revenue}`, color: "#16a34a" },
              { label: "Pending",     value: stats.pending,    color: "#f59e0b" },
              { label: "Confirmed",   value: stats.confirmed,  color: "#3b82f6" },
              { label: "Preparing",   value: stats.preparing,  color: "#8b5cf6" },
              { label: "Delivering",  value: stats.delivering, color: "#06b6d4" },
              { label: "Delivered",   value: stats.delivered,  color: "#16a34a" },
              { label: "Cancelled",   value: stats.cancelled,  color: "#dc2626" },
            ].map(s => (
              <div key={s.label} className="menu-stat">
                <span className="ms-value" style={{ color: s.color }}>{s.value}</span>
                <span className="ms-label">{s.label}</span>
              </div>
            ))}
          </div>

          <OrdersClient orders={orders} />

        </main>
      </div>
    </>
  );
}