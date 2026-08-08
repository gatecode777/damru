import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";
import RewardsClient from "./RewardsClient";

export const metadata = { title: "Rewards & Loyalty" };

export default async function RewardsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const perms = await getAdminPerms();
  if (!perms.can("rewards", "view")) redirect("/admin/dashboard");

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Rewards & Loyalty" />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h2 className="page-title">Rewards & Loyalty</h2>
              <p className="page-sub">Configure Damru reward rules, redemption limits, and manage user balances.</p>
            </div>
          </div>
          <RewardsClient perms={serializePerms(perms)} />
        </main>
      </div>
    </>
  );
}
