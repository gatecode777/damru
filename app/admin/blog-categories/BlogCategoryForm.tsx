"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Save, Loader2, ChevronRight } from "lucide-react";
import { createBlogCategory, updateBlogCategory } from "@/app/actions/blog-categories";

interface Props {
  category?: {
    _id: string; name: string; description?: string;
    sortOrder: number; isActive: boolean;
  };
}

export default function BlogCategoryForm({ category }: Props) {
  const isEdit = !!category;
  const [isPending, startTransition] = useTransition();
  const [error,    setError]    = useState<string | null>(null);
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("isActive", String(isActive));

    startTransition(async () => {
      const res = isEdit
        ? await updateBlogCategory(category._id, fd)
        : await createBlogCategory(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="form-layout">
      <div style={{ height:60, borderBottom:"1px solid #e5e7eb", background:"#fff", display:"flex", alignItems:"center", padding:"0 24px", position:"sticky", top:0, zIndex:10, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.1rem", fontWeight:700, color:"#111827" }}>
          {isEdit ? "Edit Blog Category" : "New Blog Category"}
        </h1>
      </div>

      <main className="form-main">
        <div className="breadcrumb">
          <Link href="/admin/blog-categories">Blog Categories</Link>
          <ChevronRight size={12} className="breadcrumb-sep"/>
          <span className="breadcrumb-current">{isEdit ? category.name : "New Category"}</span>
        </div>

        {error && <div className="alert-error"><span>⚠</span> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-card">
            <div className="form-card-header">
              <p className="form-card-title">Basic Information</p>
            </div>
            <div className="form-card-body">
              <div className="field">
                <label className="field-label">Category Name *</label>
                <input name="name" defaultValue={category?.name} placeholder="e.g. Healthy Food" className="inp" required />
              </div>
              <div className="field">
                <label className="field-label">Description</label>
                <textarea name="description" defaultValue={category?.description}
                  placeholder="Short description shown on blog listing or filter…"
                  className="inp-textarea" rows={3} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Sort Order</label>
                  <input name="sortOrder" type="number" defaultValue={category?.sortOrder ?? 0} min={0} className="inp" />
                  <span className="field-hint">Lower number = shown first</span>
                </div>
                <div className="field">
                  <label className="field-label">Status</label>
                  <div className="toggle-wrap" style={{ marginTop:6 }}>
                    <button type="button" onClick={() => setIsActive(!isActive)}
                      style={{ width:44, height:24, borderRadius:12, background:isActive?"#f97316":"#e5e7eb", border:"none", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                      <span style={{ position:"absolute", top:3, left:isActive?22:3, width:18, height:18, background:"#fff", borderRadius:"50%", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.15)" }} />
                    </button>
                    <span className="toggle-label">{isActive ? "Active" : "Inactive"}</span>
                  </div>
                  <span className="field-hint">Inactive categories won&apos;t appear in blog filters</span>
                </div>
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="form-footer">
              <Link href="/admin/blog-categories" className="btn-cancel">Cancel</Link>
              <div className="form-footer-actions">
                <button type="submit" disabled={isPending} className="btn-submit">
                  {isPending ? <><Loader2 size={15} className="spin"/> Saving…</> : <><Save size={15}/> {isEdit ? "Update Category" : "Create Category"}</>}
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.8s linear infinite; }`}</style>
    </div>
  );
}