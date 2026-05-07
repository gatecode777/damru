import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms } from "@/lib/adminPermissions";
import SettingsClient from "@/components/admin/SettingsClient";
import { Settings } from "lucide-react";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  // Fetch this admin's permissions
  const perms = await getAdminPerms();
  if (!perms.can("settings", "view")) redirect("/admin/dashboard");

  // If user doesn't have view permission, show access denied
  if (!perms.can("settings", "view")) {
    return (
      <>
        <AdminSidebar />
        <div className="page-layout">
          <AdminHeader title="Settings" />
          <main className="page-main">
            <div className="card" style={{ padding: 60, textAlign: "center" }}>
              <Settings size={40} style={{ color: "#dc2626", margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontFamily: "DM Sans, sans-serif", color: "#dc2626" }}>
                You don't have permission to view settings.
              </p>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Settings" />
        <main className="page-main">
          <SettingsClient />
        </main>
      </div>
    </>
  );
}