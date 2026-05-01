import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import UserForm from "../../UserForm";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/models/User";

export const metadata = { title: "Edit User" };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { id } = await params;

  let user = null;
  try {
    await connectDB();
    const raw = await UserModel.findById(id).select("-password -loginTokens").lean();
    if (!raw) notFound();
    user = JSON.parse(JSON.stringify(raw));
  } catch {
    notFound();
  }

  return (
    <>
      <AdminSidebar />
      <UserForm user={user} />
    </>
  );
}
