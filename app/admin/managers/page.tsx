import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import AdminUser from "@/models/Admin";
import ManagersClient from "./ManagersClient";

export const metadata = { title: "Admin Managers" };

export default async function AdminManagersPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  // Only super_admin can access this page
  await connectDB();
  const me = await AdminUser.findOne({ email: (session.user as any).email }).select("role").lean() as any;
  if (me?.role !== "super_admin") redirect("/admin/dashboard");

  let admins: any[] = [];
  try {
    const raw = await AdminUser.find().sort({ createdAt: -1 }).lean();
    admins = JSON.parse(JSON.stringify(raw));
  } catch { /* empty */ }

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Admin Managers" />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h2 className="page-title">Admin Managers</h2>
              <p className="page-sub">{admins.length} admin account{admins.length !== 1 ? "s" : ""} · Manage roles and module permissions</p>
            </div>
            <Link href="/admin/managers/new" className="btn-primary">
              <Plus size={14} /> Add Admin
            </Link>
          </div>
          <ManagersClient initialAdmins={admins} />
        </main>
      </div>
    </>
  );
}