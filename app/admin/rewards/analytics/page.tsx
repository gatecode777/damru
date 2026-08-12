import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAdminPerms } from "@/lib/adminPermissions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import RewardsAnalyticsClient from "./RewardsAnalyticsClient";
import "./analytics.css";

export const metadata = { title: "Rewards Analytics" };
export default async function RewardsAnalyticsPage() {
  if (!(await auth())) redirect("/admin/login");
  const perms = await getAdminPerms();
  if (!perms.can("rewards", "view")) redirect("/admin/dashboard");
  return <><AdminSidebar /><div className="page-layout"><AdminHeader title="Rewards Analytics" /><RewardsAnalyticsClient /></div></>;
}
