"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteUser } from "@/app/actions/users";
import { useRouter } from "next/navigation";
import { useAdminConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";

export default function DeleteUserBtn({
  id, name, avatar,
}: {
  id: string; name: string; avatar?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const confirmAction = useAdminConfirm();
  const toast = useToast();

  async function handle() {
    if (!(await confirmAction({ title: "Delete user?", description: `You are about to permanently delete ${name}. This action cannot be undone.`, confirmLabel: "Delete user" }))) return;
    setLoading(true);
    const res = await deleteUser(id);
    setLoading(false);
    if (res?.error) toast.error("Could not delete user", res.error);
    else router.refresh();
  }

  return (
    <button className="btn-danger" onClick={handle} disabled={loading}>
      <Trash2 size={13} /> {loading ? "…" : "Delete"}
    </button>
  );
}
