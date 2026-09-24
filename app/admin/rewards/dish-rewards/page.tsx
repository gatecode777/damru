import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms } from "@/lib/adminPermissions";
import DishRewardsClient from "./DishRewardsClient";

export const metadata = { title: "Dish Rewards" };

export default async function DishRewardsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const perms = await getAdminPerms();
  if (!perms.can("rewards", "view")) redirect("/admin/dashboard");

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Dish Rewards" />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h2 className="page-title">Dish Rewards</h2>
              <p className="page-sub">Set exactly how many Damru each dish earns. Credited when the order is delivered.</p>
            </div>
          </div>
          <DishRewardsClient canCreate={perms.can("rewards", "create")} canEdit={perms.can("rewards", "edit")} />
        </main>
      </div>
    </>
  );
}
