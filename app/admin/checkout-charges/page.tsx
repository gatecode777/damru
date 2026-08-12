import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAdminPerms } from "@/lib/adminPermissions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import CheckoutChargesClient from "./CheckoutChargesClient";
import "@/styles/admin/checkout-charges.css";

export const metadata = { title: "Checkout Charges" };

export default async function CheckoutChargesPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");
  const perms = await getAdminPerms();
  if (!perms.can("settings", "view")) redirect("/admin/dashboard");
  return <><AdminSidebar /><div className="page-layout"><AdminHeader title="Checkout Charges" /><main className="page-main"><CheckoutChargesClient canEdit={perms.can("settings", "edit")} /></main></div></>;
}
