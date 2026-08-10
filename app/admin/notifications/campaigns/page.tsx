import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";
import CampaignsClient from "./CampaignsClient";

export const metadata = { title: "Notification Campaigns" };

export default async function NotificationCampaignsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const perms = await getAdminPerms();
  if (!perms.can("notifications", "view")) redirect("/admin/dashboard");

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Notification Campaigns" />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h2 className="page-title">Notification Campaigns</h2>
              <p className="page-sub">Create, schedule, and send promotional notifications to customer segments.</p>
            </div>
          </div>
          <CampaignsClient perms={serializePerms(perms)} />
        </main>
      </div>
    </>
  );
}
