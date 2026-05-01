import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";
import BranchForm from "../../BranchForm";

export const metadata = { title: "Edit Branch" };

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  let branch = null;

  try {
    await connectDB();
    const raw = await Branch.findById(id).lean();
    if (!raw) notFound();
    branch = JSON.parse(JSON.stringify(raw));
  } catch { notFound(); }

  return (
    <>
      <AdminSidebar />
      <BranchForm initial={branch} />
    </>
  );
}