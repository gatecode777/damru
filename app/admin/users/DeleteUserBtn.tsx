"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteUser } from "@/app/actions/users";
import { useRouter } from "next/navigation";

export default function DeleteUserBtn({
  id, name, avatar,
}: {
  id: string; name: string; avatar?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handle() {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setLoading(true);
    const res = await deleteUser(id);
    setLoading(false);
    if (res?.error) alert(res.error);
    else router.refresh();
  }

  return (
    <button className="btn-danger" onClick={handle} disabled={loading}>
      <Trash2 size={13} /> {loading ? "…" : "Delete"}
    </button>
  );
}
