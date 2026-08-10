import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";
import TemplatesClient from "./TemplatesClient";

export const metadata = { title: "Notification Templates" };

export default async function NotificationTemplatesPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const perms = await getAdminPerms();
  if (!perms.can("notifications", "view")) redirect("/admin/dashboard");

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Notification Templates" />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h2 className="page-title">Notification Templates</h2>
              <p className="page-sub">Reusable templates for promotional campaigns. Transactional notifications (orders, payments, rewards) use their own built-in copy and never read from here.</p>
            </div>
          </div>
          <TemplatesClient perms={serializePerms(perms)} />
        </main>
      </div>
    </>
  );
}
