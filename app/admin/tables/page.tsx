import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";
import { connectDB } from "@/lib/mongodb";
import Table from "@/models/Table";
import TablesClient from "./TablesClient";

export const metadata = { title: "Table & QR Manager" };

export default async function AdminTablesPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  // Fetch this admin's permissions
  const perms = await getAdminPerms();
  if (!perms.can("settings", "view")) redirect("/admin/dashboard");

  let tables: any[] = [];
  try {
    await connectDB();
    const raw = await Table.find().sort({ tableNumber: 1 }).lean();
    tables = JSON.parse(JSON.stringify(raw));
  } catch { /* show empty */ }

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Table & QR Manager" />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h2 className="page-title">Table & QR Manager</h2>
              <p className="page-sub">
                {tables.length} table{tables.length !== 1 ? "s" : ""} · Manage dining tables, generate secure QR codes, and monitor statuses
              </p>
            </div>
          </div>
          <TablesClient initialTables={tables} perms={serializePerms(perms)} />
        </main>
      </div>
    </>
  );
}
