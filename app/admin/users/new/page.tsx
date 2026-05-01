import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import UserForm from "../UserForm";

export const metadata = { title: "Add User" };

export default async function NewUserPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  return (
    <>
      <AdminSidebar />
      <UserForm />
    </>
  );
}
