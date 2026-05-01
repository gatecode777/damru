import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import BranchForm from "../BranchForm";

export const metadata = { title: "New Branch" };

export default async function NewBranchPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  return (
    <>
      <AdminSidebar />
      <BranchForm />
    </>
  );
}