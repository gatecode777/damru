import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/models/User";
import OrderModel from "@/models/Order";
import ReservationModel from "@/models/Reservation";
import ComplaintModel from "@/models/Complaint";
import {
  Users, ShoppingBag, IndianRupee, CalendarDays,
  ArrowUpRight, TrendingUp, MessageSquareWarning, Clock,
} from "lucide-react";

export const metadata = { title: "Dashboard" };

async function getDashboardData() {
  try {
    await connectDB();

    const now      = new Date();
    const thisYear = now.getFullYear();
    const today    = now.toISOString().split("T")[0];

    // ── Aggregate month-by-month revenue for current year ──
    const revenueByMonth: number[] = Array(12).fill(0);
    const monthlyAgg = await OrderModel.aggregate([
      { $match: { status: { $in: ["delivered","completed"] }, createdAt: { $gte: new Date(`${thisYear}-01-01`) } } },
      { $group: { _id: { $month: "$createdAt" }, total: { $sum: "$total" } } },
    ]);
    monthlyAgg.forEach((m: any) => { revenueByMonth[m._id - 1] = m.total; });

    // ── Order status breakdown ──
    const orderStatusAgg = await OrderModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const orderStatus: Record<string,number> = {};
    orderStatusAgg.forEach((s: any) => { orderStatus[s._id] = s.count; });

    // ── Core counts ──
    const [
      totalUsers, totalOrders,
      pendingOrders, deliveredOrders,
      totalReservations, todayReservations, pendingReservations,
      openComplaints,
    ] = await Promise.all([
      UserModel.countDocuments(),
      OrderModel.countDocuments(),
      OrderModel.countDocuments({ status: "pending" }),
      OrderModel.countDocuments({ status: { $in: ["delivered","completed"] } }),
      ReservationModel.countDocuments(),
      ReservationModel.countDocuments({ date: today }),
      ReservationModel.countDocuments({ status: "pending" }),
      ComplaintModel.countDocuments({ status: { $in: ["open","in_progress"] } }),
    ]);

    // ── Total revenue ──
    const revAgg = await OrderModel.aggregate([
      { $match: { status: { $in: ["delivered","completed"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const totalRevenue = revAgg[0]?.total || 0;

    // ── This month's revenue ──
    const thisMonth = now.getMonth() + 1;
    const monthRevAgg = await OrderModel.aggregate([
      { $match: { status: { $in: ["delivered","completed"] }, createdAt: { $gte: new Date(`${thisYear}-${String(thisMonth).padStart(2,"0")}-01`) } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const monthRevenue = monthRevAgg[0]?.total || 0;

    // ── Recent orders (last 8) ──
    const rawOrders = await OrderModel.find()
      .sort({ createdAt: -1 }).limit(8).lean();
    const recentOrders = JSON.parse(JSON.stringify(rawOrders)).map((o: any) => ({
      _id:       String(o._id),
      orderId:   o.orderId || String(o._id).slice(-6).toUpperCase(),
      customer:  o.userName || o.userEmail || "Guest",
      product:   o.items?.length ? `${o.items[0].name}${o.items.length > 1 ? ` +${o.items.length - 1}` : ""}` : "—",
      amount:    o.total || 0,
      status:    o.status || "pending",
      createdAt: String(o.createdAt),
    }));

    return {
      totalUsers, totalOrders, totalRevenue, monthRevenue,
      pendingOrders, deliveredOrders,
      totalReservations, todayReservations, pendingReservations,
      openComplaints, revenueByMonth, orderStatus, recentOrders,
      fromDB: true,
    };
  } catch (e) {
    console.error("Dashboard DB error:", e);
    return {
      totalUsers: 0, totalOrders: 0, totalRevenue: 0, monthRevenue: 0,
      pendingOrders: 0, deliveredOrders: 0,
      totalReservations: 0, todayReservations: 0, pendingReservations: 0,
      openComplaints: 0, revenueByMonth: Array(12).fill(0), orderStatus: {},
      recentOrders: [], fromDB: false,
    };
  }
}

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  pending:          { bg:"#fffbeb", color:"#b45309", dot:"#f59e0b" },
  confirmed:        { bg:"#eff6ff", color:"#1d4ed8", dot:"#3b82f6" },
  preparing:        { bg:"#f5f3ff", color:"#6d28d9", dot:"#8b5cf6" },
  out_for_delivery: { bg:"#ecfeff", color:"#0e7490", dot:"#06b6d4" },
  delivered:        { bg:"#f0fdf4", color:"#15803d", dot:"#22c55e" },
  completed:        { bg:"#f0fdf4", color:"#15803d", dot:"#22c55e" },
  cancelled:        { bg:"#fef2f2", color:"#b91c1c", dot:"#dc2626" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n: number) {
  if (n >= 1000000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 10000)   return `₹${(n/1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

import { cookies } from "next/headers";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) {
    const cookieStore = await cookies();
    const cookieNames = cookieStore.getAll().map(c => c.name).join(",");
    redirect(`/admin/login?debug_session_null=true&cookies=${encodeURIComponent(cookieNames)}`);
  }

  const d = await getDashboardData();
  const maxRev = Math.max(...d.revenueByMonth, 1);
  const curMonth = new Date().getMonth();

  const orderStatusEntries = Object.entries(d.orderStatus).sort((a,b) => b[1]-a[1]);

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Dashboard" />
        <main className="page-main">

          {!d.fromDB && (
            <div style={{ background:"#fffbeb", border:"1.5px solid #fde68a", borderRadius:10, padding:"11px 16px", fontSize:"0.83rem", color:"#92400e", display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              <span style={{ width:8, height:8, background:"#f59e0b", borderRadius:"50%", flexShrink:0 }} />
              <strong>Could not connect to MongoDB.</strong> Check your connection string and Atlas IP whitelist.
            </div>
          )}

          {/* ── Welcome ── */}
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
            <div>
              <h2 style={{ fontFamily:"Syne,sans-serif", fontSize:"1.1rem", fontWeight:700, color:"#111827", marginBottom:3 }}>
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {session.user?.name} 👋
              </h2>
              <p style={{ fontSize:"0.84rem", color:"#6b7280" }}>Here&apos;s what&apos;s happening at Damru today.</p>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:20, padding:"5px 14px", fontSize:"0.78rem", fontWeight:500, color:"#16a34a" }}>
              <span style={{ width:7, height:7, background:"#22c55e", borderRadius:"50%", animation:"pulse 2s infinite" }} />Live
            </div>
          </div>

          {/* ── Stat cards ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
            {[
              { label:"Total Revenue",    value:fmt(d.totalRevenue), sub:`${fmt(d.monthRevenue)} this month`, icon:IndianRupee, color:"#f97316", bg:"#fff7ed", border:"#fed7aa" },
              { label:"Total Users",      value:d.totalUsers.toLocaleString(),                sub:"Registered accounts",                                    icon:Users,       color:"#2563eb", bg:"#eff6ff", border:"#bfdbfe" },
              { label:"Total Orders",     value:d.totalOrders.toLocaleString(),               sub:`${d.pendingOrders} pending`,                              icon:ShoppingBag, color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe" },
              { label:"Reservations",     value:d.totalReservations.toLocaleString(),         sub:`${d.todayReservations} today · ${d.pendingReservations} pending`, icon:CalendarDays, color:"#059669", bg:"#ecfdf5", border:"#a7f3d0" },
            ].map(s => (
              <div key={s.label} style={{ background:"#fff", border:`1.5px solid ${s.border}`, borderRadius:14, padding:18, display:"flex", flexDirection:"column", gap:10, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:s.bg, border:`1.5px solid ${s.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <s.icon size={18} style={{ color:s.color }} />
                  </div>
                  <ArrowUpRight size={15} style={{ color:"#d1d5db" }} />
                </div>
                <p style={{ fontFamily:"Syne,sans-serif", fontSize:"1.6rem", fontWeight:700, color:"#111827", letterSpacing:"-0.02em" }}>{s.value}</p>
                <div>
                  <span style={{ fontSize:"0.78rem", color:"#6b7280", display:"block" }}>{s.label}</span>
                  <span style={{ fontSize:"0.72rem", color:s.color, fontWeight:500 }}>{s.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Alert row ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <Link href="/admin/complaints" style={{ background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, textDecoration:"none" }}>
              <div style={{ width:40, height:40, background:"#fee2e2", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <MessageSquareWarning size={18} style={{ color:"#dc2626" }} />
              </div>
              <div>
                <p style={{ fontFamily:"DM Sans,sans-serif", fontWeight:700, fontSize:"1.3rem", color:"#dc2626" }}>{d.openComplaints}</p>
                <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.8rem", color:"#b91c1c" }}>Open Complaints — needs attention</p>
              </div>
            </Link>
            <Link href="/admin/reservations" style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, textDecoration:"none" }}>
              <div style={{ width:40, height:40, background:"#ffedd5", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Clock size={18} style={{ color:"#f97316" }} />
              </div>
              <div>
                <p style={{ fontFamily:"DM Sans,sans-serif", fontWeight:700, fontSize:"1.3rem", color:"#f97316" }}>{d.pendingReservations}</p>
                <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.8rem", color:"#c2410c" }}>Pending Reservations — confirm them</p>
              </div>
            </Link>
          </div>

          {/* ── Chart row ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:14 }}>

            {/* Revenue bar chart */}
            <div className="dash-card">
              <div className="dash-card-head">
                <div>
                  <p className="dash-card-title">Revenue Overview — {new Date().getFullYear()}</p>
                  <p className="dash-card-sub">Monthly revenue from delivered orders · Total {fmt(d.totalRevenue)}</p>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:160, paddingTop:8 }}>
                {d.revenueByMonth.map((rev, i) => {
                  const pct  = maxRev > 0 ? Math.max(2, (rev / maxRev) * 100) : 2;
                  const isCur = i === curMonth;
                  return (
                    <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, height:"100%" }} title={`${MONTHS[i]}: ₹${rev.toLocaleString("en-IN")}`}>
                      <div style={{ flex:1, display:"flex", alignItems:"flex-end", width:"100%" }}>
                        <div style={{ width:"100%", height:`${pct}%`, background: isCur ? "#f97316" : "#fed7aa", borderRadius:"5px 5px 0 0", minHeight:4, transition:"height 0.3s" }} />
                      </div>
                      {rev > 0 && <span style={{ fontSize:"0.55rem", color:isCur?"#f97316":"#9ca3af", fontWeight:isCur?700:400 }}>{fmt(rev)}</span>}
                      <span style={{ fontSize:"0.62rem", color: isCur?"#f97316":"#9ca3af", fontWeight:isCur?700:400 }}>{MONTHS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order status breakdown */}
            <div className="dash-card">
              <p className="dash-card-title" style={{ marginBottom:14 }}>Order Status Breakdown</p>
              {orderStatusEntries.length === 0
                ? <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.85rem", color:"#aaa" }}>No orders yet.</p>
                : orderStatusEntries.map(([status, count]) => {
                    const ss = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
                    const pct = d.totalOrders > 0 ? Math.round((count/d.totalOrders)*100) : 0;
                    return (
                      <div key={status} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.8rem", color:"#374151", display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ width:7, height:7, borderRadius:"50%", background:ss.dot, flexShrink:0 }} />
                            {status.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
                          </span>
                          <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.8rem", fontWeight:600, color:ss.color }}>{count}</span>
                        </div>
                        <div style={{ height:5, background:"#f3f4f6", borderRadius:99 }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:ss.dot, borderRadius:99, transition:"width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          </div>

          {/* ── Recent Orders table ── */}
            <div className="dash-card">
            <div className="dash-card-head">
              <div>
                <p className="dash-card-title">Recent Orders</p>
                <p className="dash-card-sub">Last 8 orders from all customers</p>
              </div>
              <Link href="/admin/orders" style={{ background:"#fff7ed", border:"1px solid #fed7aa", color:"#f97316", borderRadius:8, padding:"6px 13px", fontFamily:"DM Sans,sans-serif", fontSize:"0.8rem", fontWeight:500, textDecoration:"none" }}>
                View All →
              </Link>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
                <thead>
                  <tr>
                    {["Order ID","Customer","Items","Amount","Status","Date"].map(h=>(
                      <th key={h} style={{ textAlign:"left", padding:"0 12px 10px", fontSize:"0.69rem", fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", color:"#9ca3af", borderBottom:"1.5px solid #f3f4f6" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.recentOrders.length === 0
                    ? <tr><td colSpan={6} style={{ padding:"30px 12px", textAlign:"center", color:"#aaa", fontFamily:"DM Sans,sans-serif", fontSize:"0.85rem" }}>No orders yet.</td></tr>
                    : d.recentOrders.map((o: any) => {
                        const ss = STATUS_STYLE[o.status] ?? STATUS_STYLE.pending;
                        return (
                          <tr key={o._id} className="dash-trow">
                            <td style={{ padding:"10px 12px", fontSize:"0.82rem", borderBottom:"1px solid #f9fafb", fontFamily:"monospace", color:"#f97316", fontWeight:600 }}>#{o.orderId}</td>
                            <td style={{ padding:"10px 12px", fontSize:"0.84rem", borderBottom:"1px solid #f9fafb", fontWeight:500, color:"#111827" }}>{o.customer}</td>
                            <td style={{ padding:"10px 12px", fontSize:"0.82rem", borderBottom:"1px solid #f9fafb", color:"#4b5563", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{o.product}</td>
                            <td style={{ padding:"10px 12px", fontSize:"0.84rem", borderBottom:"1px solid #f9fafb", fontWeight:600, color:"#111827" }}>₹{o.amount.toLocaleString("en-IN")}</td>
                            <td style={{ padding:"10px 12px", borderBottom:"1px solid #f9fafb" }}>
                              <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:20, fontSize:"0.72rem", fontWeight:500, textTransform:"capitalize", whiteSpace:"nowrap", background:ss.bg, color:ss.color }}>
                                <span style={{ width:5, height:5, borderRadius:"50%", background:ss.dot, flexShrink:0 }} />
                                {o.status.replace(/_/g," ")}
                              </span>
                            </td>
                            <td style={{ padding:"10px 12px", fontSize:"0.78rem", borderBottom:"1px solid #f9fafb", color:"#9ca3af", whiteSpace:"nowrap" }}>
                              {new Date(o.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
                            </td>
                          </tr>
                        );
                      })
                  }
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        .dash-trow:hover td { background: #fffbf5; }
        .dash-card { background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
        .dash-card-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:8px; }
        .dash-card-title { font-family:'Syne',sans-serif; font-size:0.95rem; font-weight:700; color:#111827; margin-bottom:3px; }
        .dash-card-sub { font-size:0.76rem; color:#9ca3af; }
        .dash-stat { background:#fff; border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:10px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
        .dash-stat-val { font-family:'Syne',sans-serif; font-size:1.6rem; font-weight:700; color:#111827; letter-spacing:-0.02em; }
      `}</style>
    </>
  );
}