"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteCategory } from "@/app/actions/categories";
import { useRouter } from "next/navigation";

export default function DeleteCategoryBtn({ id, name }: { id: string; name: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handle() {
    if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return;
    setLoading(true);
    const res = await deleteCategory(id);
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
