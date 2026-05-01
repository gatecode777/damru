import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import OrderModel from "@/models/Order";
import UserModel from "@/models/User";
import ReservationModel from "@/models/Reservation";
import ComplaintModel from "@/models/Complaint";
import { TrendingUp, Users, IndianRupee, ShoppingBag } from "lucide-react";

export const metadata = { title: "Analytics" };

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  let totalUsers = 0, totalOrders = 0, totalRevenue = 0, totalReservations = 0, totalComplaints = 0;
  let monthlyData:  { month: string; revenue: number; count: number }[] = [];
  let topItems:     { name: string; revenue: number; count: number }[] = [];
  let statusData:   { status: string; count: number; pct: number }[] = [];
  let categoryData: { name: string; count: number; revenue: number }[] = [];
  let paymentData:  { method: string; count: number; pct: number }[] = [];
  let fromDB = false;

  const thisYear = new Date().getFullYear();

  try {
    await connectDB();

    const [
      uCount, oCount, resCount, compCount,
      revAgg, monthAgg, itemAgg, statusAgg, payAgg,
    ] = await Promise.all([
      UserModel.countDocuments(),
      OrderModel.countDocuments(),
      ReservationModel.countDocuments(),
      ComplaintModel.countDocuments(),

      // Total revenue from delivered orders
      OrderModel.aggregate([
        { $match: { status: { $in: ["delivered","completed"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),

      // Month-by-month revenue for current year
      OrderModel.aggregate([
        { $match: { status: { $in: ["delivered","completed"] }, createdAt: { $gte: new Date(`${thisYear}-01-01`) } } },
        { $group: { _id: { $month: "$createdAt" }, revenue: { $sum: "$total" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // Top menu items by order count + revenue
      OrderModel.aggregate([
        { $unwind: "$items" },
        { $group: { _id: "$items.name", count: { $sum: "$items.qty" }, revenue: { $sum: { $multiply: ["$items.price","$items.qty"] } } } },
        { $sort: { revenue: -1 } },
        { $limit: 7 },
      ]),

      // Order status breakdown
      OrderModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Payment method breakdown
      OrderModel.aggregate([
        { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    totalUsers        = uCount;
    totalOrders       = oCount;
    totalRevenue      = revAgg[0]?.total || 0;
    totalReservations = resCount;
    totalComplaints   = compCount;

    // Monthly chart
    const mMap: Record<number, { revenue: number; count: number }> = {};
    monthAgg.forEach((m: any) => { mMap[m._id] = m; });
    monthlyData = MONTHS.map((m, i) => ({ month: m, revenue: mMap[i+1]?.revenue || 0, count: mMap[i+1]?.count || 0 }));

    // Top items
    topItems = itemAgg.map((p: any) => ({ name: p._id || "Unknown", revenue: p.revenue || 0, count: p.count || 0 }));

    // Status breakdown
    const sTotal = statusAgg.reduce((s: number, a: any) => s + a.count, 0);
    statusData = statusAgg.map((a: any) => ({
      status: a._id,
      count:  a.count,
      pct:    sTotal ? Math.round((a.count / sTotal) * 100) : 0,
    }));

    // Payment breakdown
    const pTotal = payAgg.reduce((s: number, a: any) => s + a.count, 0);
    paymentData = payAgg.map((a: any) => ({
      method: a._id || "unknown",
      count:  a.count,
      pct:    pTotal ? Math.round((a.count / pTotal) * 100) : 0,
    }));

    fromDB = true;
  } catch (e) {
    console.error("Analytics DB error:", e);
  }

  const maxRev  = Math.max(...monthlyData.map(d => d.revenue), 1);
  const maxItem = Math.max(...topItems.map(p => p.revenue), 1);
  const curMonth = new Date().getMonth();

  const avgOrderVal = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  function fmt(n: number) {
    if (n >= 1000000) return `₹${(n/100000).toFixed(1)}L`;
    if (n >= 10000)   return `₹${(n/1000).toFixed(1)}K`;
    return `₹${n.toLocaleString("en-IN")}`;
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

  const PAY_LABEL: Record<string,string> = { cod:"Cash on Delivery", upi:"UPI", card:"Credit / Debit Card" };

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Analytics" />
        <main className="page-main">

          {!fromDB && (
            <div style={{ display:"flex", alignItems:"center", gap:10, background:"#fffbeb", border:"1.5px solid #fde68a", borderRadius:10, padding:"11px 16px", fontSize:"0.83rem", color:"#92400e" }}>
              <span style={{ width:8, height:8, background:"#f59e0b", borderRadius:"50%", flexShrink:0 }} />
              <strong>Could not connect to MongoDB.</strong> Check your connection string and Atlas IP whitelist.
            </div>
          )}

          {/* ── KPI cards ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14 }}>
            {[
              { label:"Total Revenue",    value:fmt(totalRevenue),                  sub:`Avg ₹${avgOrderVal.toLocaleString("en-IN")} / order`, icon:IndianRupee, color:"#f97316", bg:"#fff7ed", border:"#fed7aa" },
              { label:"Total Orders",     value:totalOrders.toLocaleString(),        sub:`${statusData.find(s=>s.status==="pending")?.count||0} pending`, icon:ShoppingBag, color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe" },
              { label:"Total Users",      value:totalUsers.toLocaleString(),         sub:"Registered accounts",          icon:Users,       color:"#2563eb", bg:"#eff6ff", border:"#bfdbfe" },
              { label:"Reservations",     value:totalReservations.toLocaleString(),  sub:"All time bookings",            icon:TrendingUp,  color:"#059669", bg:"#ecfdf5", border:"#a7f3d0" },
              { label:"Complaints",       value:totalComplaints.toLocaleString(),    sub:`${statusData.find(s=>["open","in_progress"].includes(s.status))?.count||0} open`, icon:TrendingUp, color:"#dc2626", bg:"#fef2f2", border:"#fecaca" },
            ].map(k => (
              <div key={k.label} style={{ background:"#fff", border:`1.5px solid ${k.border}`, borderRadius:14, padding:18, display:"flex", flexDirection:"column", gap:8, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ width:38, height:38, borderRadius:10, background:k.bg, border:`1.5px solid ${k.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <k.icon size={16} style={{ color:k.color }} />
                </div>
                <p style={{ fontFamily:"Syne,sans-serif", fontSize:"1.5rem", fontWeight:700, color:"#111827", letterSpacing:"-0.02em" }}>{k.value}</p>
                <div>
                  <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.78rem", color:"#6b7280" }}>{k.label}</p>
                  <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.7rem", color:k.color, fontWeight:500 }}>{k.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Revenue bar chart ── */}
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
              <div>
                <p style={{ fontFamily:"Syne,sans-serif", fontSize:"0.95rem", fontWeight:700, color:"#111827", marginBottom:3 }}>Revenue Overview — {thisYear}</p>
                <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.76rem", color:"#9ca3af" }}>Monthly revenue from delivered orders · Total {fmt(totalRevenue)}</p>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:180 }}>
              {monthlyData.map((d, i) => {
                const pct    = maxRev > 0 ? Math.max(d.revenue ? 3 : 0, (d.revenue/maxRev)*100) : 0;
                const isCur  = i === curMonth;
                return (
                  <div key={d.month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, height:"100%" }} title={`${d.month}: ${fmt(d.revenue)} · ${d.count} orders`}>
                    <div style={{ flex:1, display:"flex", alignItems:"flex-end", width:"100%" }}>
                      <div style={{ width:"100%", height:`${pct}%`, background:isCur?"#f97316":"#fed7aa", borderRadius:"5px 5px 0 0", minHeight:d.revenue?3:0, transition:"height 0.4s" }} />
                    </div>
                    {d.revenue > 0 && <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.55rem", color:isCur?"#f97316":"#9ca3af", fontWeight:isCur?700:400, whiteSpace:"nowrap" }}>{fmt(d.revenue)}</span>}
                    <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.62rem", color:isCur?"#f97316":"#9ca3af", fontWeight:isCur?700:400 }}>{d.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 3-col row ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>

            {/* Top menu items */}
            <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
              <p style={{ fontFamily:"Syne,sans-serif", fontSize:"0.95rem", fontWeight:700, color:"#111827", marginBottom:14 }}>Top Menu Items</p>
              {topItems.length === 0
                ? <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.85rem", color:"#aaa" }}>No orders yet.</p>
                : topItems.map(p => (
                  <div key={p.name} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.82rem", color:"#374151", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{p.name}</span>
                      <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.82rem", fontWeight:700, color:"#111827", flexShrink:0 }}>{fmt(p.revenue)}</span>
                    </div>
                    <div style={{ height:5, background:"#f3f4f6", borderRadius:99, overflow:"hidden", marginBottom:2 }}>
                      <div style={{ height:"100%", width:`${(p.revenue/maxItem)*100}%`, background:"linear-gradient(90deg,#f97316,#fb923c)", borderRadius:99 }} />
                    </div>
                    <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.7rem", color:"#9ca3af" }}>{p.count} qty sold</span>
                  </div>
                ))
              }
            </div>

            {/* Order status */}
            <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
              <p style={{ fontFamily:"Syne,sans-serif", fontSize:"0.95rem", fontWeight:700, color:"#111827", marginBottom:14 }}>Order Status Breakdown</p>
              {statusData.length === 0
                ? <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.85rem", color:"#aaa" }}>No orders yet.</p>
                : statusData.map(s => {
                    const ss = STATUS_STYLE[s.status] ?? STATUS_STYLE.pending;
                    return (
                      <div key={s.status} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.8rem", color:"#374151", display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ width:7, height:7, borderRadius:"50%", background:ss.dot, flexShrink:0 }} />
                            {s.status.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
                          </span>
                          <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.8rem", fontWeight:600, color:ss.color }}>{s.count} <span style={{ color:"#9ca3af", fontWeight:400 }}>({s.pct}%)</span></span>
                        </div>
                        <div style={{ height:5, background:"#f3f4f6", borderRadius:99 }}>
                          <div style={{ height:"100%", width:`${s.pct}%`, background:ss.dot, borderRadius:99, transition:"width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })
              }
            </div>

            {/* Payment methods */}
            <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
              <p style={{ fontFamily:"Syne,sans-serif", fontSize:"0.95rem", fontWeight:700, color:"#111827", marginBottom:14 }}>Payment Methods</p>
              {paymentData.length === 0
                ? <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.85rem", color:"#aaa" }}>No orders yet.</p>
                : paymentData.map((p, i) => {
                    const colors = ["#f97316","#3b82f6","#8b5cf6","#16a34a","#dc2626"];
                    const col    = colors[i % colors.length];
                    return (
                      <div key={p.method} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.82rem", color:"#374151", fontWeight:500 }}>
                            {PAY_LABEL[p.method] || p.method.charAt(0).toUpperCase() + p.method.slice(1)}
                          </span>
                          <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.82rem", fontWeight:700, color:col }}>{p.count} <span style={{ color:"#9ca3af", fontWeight:400 }}>({p.pct}%)</span></span>
                        </div>
                        <div style={{ height:6, background:"#f3f4f6", borderRadius:99, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${p.pct}%`, background:col, borderRadius:99, opacity:0.8 }} />
                        </div>
                      </div>
                    );
                  })
              }

              {/* Summary numbers */}
              <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid #f3f4f6" }}>
                {[
                  { label:"Total Revenue",  value:fmt(totalRevenue) },
                  { label:"Total Orders",   value:totalOrders.toLocaleString() },
                  { label:"Avg Order Val",  value:`₹${avgOrderVal.toLocaleString("en-IN")}` },
                  { label:"Delivered",      value:(statusData.find(s=>["delivered","completed"].includes(s.status))?.count||0).toString() },
                ].map(m => (
                  <div key={m.label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #f9fafb" }}>
                    <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.82rem", color:"#6b7280" }}>{m.label}</span>
                    <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"0.84rem", fontWeight:700, color:"#f97316" }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </main>
      </div>
    </>
  );
}