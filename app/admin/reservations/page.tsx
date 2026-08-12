import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";
import { connectDB } from "@/lib/mongodb";
import Reservation from "@/models/Reservation";
import ReservationsClient from "./ReservationsClient";

export const metadata = { title: "Reservations" };

export type ReservationRow = {
  _id: string;
  userName: string; userEmail: string; userPhone: string;
  date: string; time: string; persons: string; notes: string;
  status: string; declineReason: string; createdAt: string;
};

export default async function ReservationsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  // Fetch this admin's permissions
  const perms = await getAdminPerms();
  if (!perms.can("reservations", "view")) redirect("/admin/dashboard");

  let reservations: ReservationRow[] = [];

  try {
    await connectDB();
    const raw = await Reservation.find()
      .sort({ date: -1, createdAt: -1 })
      .lean();
    reservations = raw.map((r) => ({
      _id:       String(r._id),
      userName:  r.userName,
      userEmail: r.userEmail,
      userPhone: r.userPhone || "",
      date:      r.date,
      time:      r.time,
      persons:   r.persons,
      notes:     r.notes || "",
      status:    r.status,
      declineReason: r.declineReason || "",
      createdAt: String(r.createdAt),
    }));
  } catch { /* empty on first run */ }

  const today    = new Date().toISOString().split("T")[0];
  const upcoming = reservations.filter(r => r.date >= today && r.status !== "cancelled").length;

  const stats = {
    total:     reservations.length,
    pending:   reservations.filter(r => r.status === "pending").length,
    confirmed: reservations.filter(r => r.status === "confirmed").length,
    cancelled: reservations.filter(r => r.status === "cancelled").length,
    today:     reservations.filter(r => r.date === today).length,
    upcoming,
  };

  const serializedPerms = serializePerms(perms);

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Reservations" />
        <main className="page-main">

          <div className="page-header">
            <div>
              <h2 className="page-title">Reservations</h2>
              <p className="page-sub">{reservations.length} total · {upcoming} upcoming</p>
            </div>
          </div>

          {/* Stats */}
          <div className="menu-stats">
            {[
              { label: "Total",     value: stats.total,     color: "#f97316" },
              { label: "Today",     value: stats.today,     color: "#3b82f6" },
              { label: "Upcoming",  value: stats.upcoming,  color: "#8b5cf6" },
              { label: "Pending",   value: stats.pending,   color: "#f59e0b" },
              { label: "Confirmed", value: stats.confirmed, color: "#16a34a" },
              { label: "Declined",  value: stats.cancelled, color: "#dc2626" },
            ].map(s => (
              <div key={s.label} className="menu-stat">
                <span className="ms-value" style={{ color: s.color }}>{s.value}</span>
                <span className="ms-label">{s.label}</span>
              </div>
            ))}
          </div>

          <ReservationsClient reservations={reservations} perms={serializedPerms} />

        </main>
      </div>
    </>
  );
}
