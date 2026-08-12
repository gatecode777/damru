import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAdminPerms } from "@/lib/adminPermissions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import RiskDashboardClient from "./RiskDashboardClient";
import "./risk.css";

export const metadata = { title: "Rewards Risk & Abuse" };

export default async function RewardsRiskPage() {
  if (!(await auth())) redirect("/admin/login");
  const perms = await getAdminPerms();
  if (!perms.can("rewards", "view")) redirect("/admin/dashboard");
  return <><AdminSidebar /><div className="page-layout"><AdminHeader title="Risk & Abuse" /><RiskDashboardClient canEdit={perms.can("rewards", "edit")} /></div></>;
}
