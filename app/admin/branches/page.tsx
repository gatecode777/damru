import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";
import BranchesClient from "./BranchesClient";

export const metadata = { title: "Branches Manager" };

export default async function AdminBranchesPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  let branches: any[] = [];
  try {
    await connectDB();
    const raw = await Branch.find().sort({ sortOrder: 1 }).lean();
    branches = JSON.parse(JSON.stringify(raw));
  } catch { /* show empty */ }

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Branches Manager" />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h2 className="page-title">Branches Manager</h2>
              <p className="page-sub">{branches.length} branch{branches.length !== 1 ? "es" : ""} · Manage locations, hall cards, and content</p>
            </div>
          </div>
          <BranchesClient initialBranches={branches} />
        </main>
      </div>
    </>
  );
}