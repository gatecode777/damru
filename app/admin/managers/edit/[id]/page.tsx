import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { connectDB } from "@/lib/mongodb";
import AdminUser from "@/models/Admin";
import ManagerForm from "../../ManagerForm";

export const metadata = { title: "Edit Admin Manager" };

export default async function EditManagerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  await connectDB();

  const me = await AdminUser.findOne({ email: (session.user as any).email }).select("role").lean() as any;
  if (me?.role !== "super_admin") redirect("/admin/dashboard");

  const admin = await AdminUser.findById(id).lean() as any;
  if (!admin || admin.role === "super_admin") notFound();

  return (
    <>
      <AdminSidebar />
      <ManagerForm initial={JSON.parse(JSON.stringify(admin))} />
    </>
  );
}