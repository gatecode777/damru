import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import SettingsClient from "@/components/admin/SettingsClient";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");
  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Settings" />
        <SettingsClient />
      </div>
    </>
  );
}