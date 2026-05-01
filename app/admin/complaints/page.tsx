import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import Complaint from "@/models/Complaint";
import ComplaintsClient from "./ComplaintsClient";

export const metadata = { title: "Complaints" };

export type ComplaintRow = {
  _id: string;
  userName: string; userEmail: string;
  issueType: string; subject: string; description: string;
  attachment: string; status: string; adminNote: string;
  createdAt: string;
};

export default async function ComplaintsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  let complaints: ComplaintRow[] = [];

  try {
    await connectDB();
    const raw = await Complaint.find().sort({ createdAt: -1 }).lean();
    complaints = JSON.parse(JSON.stringify(raw)).map((c: any) => ({
      _id:         String(c._id),
      userName:    c.userName,
      userEmail:   c.userEmail,
      issueType:   c.issueType,
      subject:     c.subject,
      description: c.description,
      attachment:  c.attachment || "",
      status:      c.status,
      adminNote:   c.adminNote || "",
      createdAt:   String(c.createdAt),
    }));
  } catch { /* empty */ }

  const stats = {
    total:       complaints.length,
    open:        complaints.filter(c => c.status === "open").length,
    in_progress: complaints.filter(c => c.status === "in_progress").length,
    resolved:    complaints.filter(c => c.status === "resolved").length,
    closed:      complaints.filter(c => c.status === "closed").length,
  };

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Complaints" />
        <main className="page-main">

          <div className="page-header">
            <div>
              <h2 className="page-title">Complaints</h2>
              <p className="page-sub">{complaints.length} total · {stats.open} open</p>
            </div>
          </div>

          <div className="menu-stats">
            {[
              { label: "Total",       value: stats.total,       color: "#f97316" },
              { label: "Open",        value: stats.open,        color: "#dc2626" },
              { label: "In Progress", value: stats.in_progress, color: "#f59e0b" },
              { label: "Resolved",    value: stats.resolved,    color: "#16a34a" },
              { label: "Closed",      value: stats.closed,      color: "#6b7280" },
            ].map(s => (
              <div key={s.label} className="menu-stat">
                <span className="ms-value" style={{ color: s.color }}>{s.value}</span>
                <span className="ms-label">{s.label}</span>
              </div>
            ))}
          </div>

          <ComplaintsClient complaints={complaints} />

        </main>
      </div>
    </>
  );
}