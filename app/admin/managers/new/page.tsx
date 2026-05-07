import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { connectDB } from "@/lib/mongodb";
import AdminUser from "@/models/Admin";
import ManagerForm from "../ManagerForm";

export const metadata = { title: "New Admin Manager" };

export default async function NewManagerPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");
  await connectDB();
  const me = await AdminUser.findOne({ email: (session.user as any).email }).select("role").lean() as any;
  if (me?.role !== "super_admin") redirect("/admin/dashboard");

  return (
    <>
      <AdminSidebar />
      <ManagerForm />
    </>
  );
}