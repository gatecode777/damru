import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms } from "@/lib/adminPermissions";
import EarnRulesClient from "./EarnRulesClient";

export const metadata = { title: "Damru Earn Rules" };

export default async function EarnRulesPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const perms = await getAdminPerms();
  if (!perms.can("rewards", "view")) redirect("/admin/dashboard");

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Damru Earn Rules" />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h2 className="page-title">Earn Rules</h2>
              <p className="page-sub">Reward specific dishes, categories and order values with Damru. Credited when an order is delivered.</p>
            </div>
          </div>
          <EarnRulesClient canCreate={perms.can("rewards", "create")} canEdit={perms.can("rewards", "edit")} />
        </main>
      </div>
    </>
  );
}
