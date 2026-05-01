import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/models/User";
import { fallbackUsers } from "@/lib/fallbackData";
import UsersClient from "./UsersClient";
import { Plus, Download } from "lucide-react";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  type UserRow = {
    _id: string; name: string; email: string;
    phone?: string;
    status: string; totalSpend: number;
    avatar?: string; createdAt: string;
  };

  let users: UserRow[] = [];
  let fromDB = false;
  let countMap: Record<string, number> = {};

  try {
    await connectDB();
    const [raw, counts] = await Promise.all([
      UserModel.find().sort({ createdAt: -1 }),
      UserModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    users = JSON.parse(JSON.stringify(raw));
    counts.forEach((c: { _id: string; count: number }) => { countMap[c._id] = c.count; });
    fromDB = true;
  } catch {
    countMap = { active: 6, inactive: 1, suspended: 1 };
  }

  const totalSpend = users.reduce((s, u) => s + u.totalSpend, 0);

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Users" />
        <main className="page-main">

          {!fromDB && (
            <div className="db-warn">
              <span className="db-warn-dot" />
              <strong>Demo data.</strong> Run <code>npm run seed</code> to load real data from MongoDB.
            </div>
          )}

          {/* Page header */}
          <div className="page-header">
            <div>
              <h2 className="page-title">All Users</h2>
              <p className="page-sub">{users.length} registered users</p>
            </div>
          </div>

          {/* Stats bar — server-rendered for accuracy */}
          <div className="user-stats">
            {[
              { label: "Total",     value: users.length,            color: "#f97316" },
              { label: "Active",    value: countMap.active    || 0, color: "#16a34a" },
              { label: "Inactive",  value: countMap.inactive  || 0, color: "#6b7280" },
              { label: "Suspended", value: countMap.suspended || 0, color: "#dc2626" },
              { label: "Revenue",   value: `₹${totalSpend.toLocaleString("en-IN")}`, color: "#7c3aed" },
            ].map(s => (
              <div key={s.label} className="user-stat">
                <span className="us-value" style={{ color: s.color }}>{s.value}</span>
                <span className="us-label">{s.label}</span>
              </div>
            ))}
          </div>

          {/* All interactive parts delegated to client component */}
          <UsersClient users={users} countMap={countMap} fromDB={fromDB} />

        </main>
      </div>
    </>
  );
}