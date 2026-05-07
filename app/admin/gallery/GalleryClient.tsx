"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2, Plus, Save, Loader2,
  Eye, EyeOff, ImageIcon, ChevronDown, ChevronUp, GripVertical, X,
} from "lucide-react";
import {
  upsertGalleryTab, deleteGalleryTab, toggleGalleryTabActive,
  addGalleryItem, updateGalleryItem, deleteGalleryItem,
} from "@/app/actions/gallery";

interface Perms { role: string; isSuperAdmin: boolean; permissions: Record<string, any>; }

interface GalleryItem {
  _id: string; image: string; alt: string; title: string;
  description: string; type: string; overlayClass: string; sortOrder: number;
}
interface GalleryTab {
  _id: string; tabKey: string; label: string;
  bannerImage: string; bannerAlt: string;
  isActive: boolean; sortOrder: number;
  items: GalleryItem[];
}

const lbl: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 600, color: "#374151", fontFamily: "DM Sans,sans-serif", display: "block", marginBottom: 4 };
const inp: React.CSSProperties = { width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "7px 10px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", color: "#111827", outline: "none", boxSizing: "border-box" };

// ── Image upload ─────────────────────────────────────────────
function ImageUpload({ current, target, onDone, label, height = 140, canEdit }: {
  current: string; target: string; onDone: (f: string) => void;
  label: string; height?: number; canEdit?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState(current);
  const ref = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canEdit) return;
    const file = e.target.files?.[0]; if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("target", target);
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.filename) { setPreview(`/uploads/gallery/${data.filename}`); onDone(data.filename); }
    } finally { setUploading(false); }
  }

  return (
    <div>
      <label style={lbl}>{label}</label>
      <div
        style={{ border: "2px dashed #e5e7eb", borderRadius: 10, overflow: "hidden", cursor: canEdit ? "pointer" : "default", height, display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", position: "relative", transition: "border-color 0.15s" }}
        onClick={() => canEdit && ref.current?.click()}
        onMouseEnter={e => { if (canEdit) e.currentTarget.style.borderColor = "#f97316"; }}
        onMouseLeave={e => { if (canEdit) e.currentTarget.style.borderColor = "#e5e7eb"; }}
      >
        {preview ? (
          <>
            <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {uploading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Loader2 size={22} style={{ color: "#fff", animation: "spin 0.8s linear infinite" }} />
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", color: "#9ca3af", fontFamily: "DM Sans,sans-serif" }}>
            {uploading ? <Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /> : <ImageIcon size={24} />}
            <p style={{ fontSize: "0.78rem", marginTop: 6 }}>{uploading ? "Uploading…" : canEdit ? "Click to upload" : "No image"}</p>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handleChange} />
      {preview && !preview.startsWith("blob:") && canEdit && (
        <button type="button" onClick={() => { setPreview(""); onDone(""); }}
          style={{ marginTop: 4, background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem", fontFamily: "DM Sans,sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
          <Trash2 size={11}/> Remove
        </button>
      )}
    </div>
  );
}

// ── Item row ─────────────────────────────────────────────────
function ItemRow({ item, tabId, onItemSaved, onItemDeleted, canEdit, canDelete }: {
  item: GalleryItem; tabId: string;
  onItemSaved: (itemId: string, patch: Partial<GalleryItem>) => void;
  onItemDeleted: (itemId: string) => void;
  canEdit: boolean; canDelete: boolean;
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [image,     setImage]     = useState(item.image);
  const [title,     setTitle]     = useState(item.title);
  const [desc,      setDesc]      = useState(item.description);
  const [alt,       setAlt]       = useState(item.alt);
  const [type,      setType]      = useState(item.type);
  const [overlay,   setOverlay]   = useState(item.overlayClass);
  const [sortOrder, setSortOrder] = useState(item.sortOrder);

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    const fd = new FormData();
    fd.append("image", image); fd.append("alt", alt); fd.append("title", title);
    fd.append("description", desc); fd.append("type", type);
    fd.append("overlayClass", overlay); fd.append("sortOrder", String(sortOrder));
    await updateGalleryItem(tabId, item._id, fd);
    setSaving(false);
    onItemSaved(item._id, { image, alt, title, description: desc, type, overlayClass: overlay, sortOrder });
    setExpanded(false);
  }

  async function handleDelete() {
    if (!canDelete) return;
    if (!confirm(`Delete "${title}"?`)) return;
    setDeleting(true);
    await deleteGalleryItem(tabId, item._id);
    onItemDeleted(item._id);
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 8, opacity: deleting ? 0.4 : 1, transition: "opacity 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fafafa", cursor: "pointer" }} onClick={() => setExpanded(v => !v)}>
        <GripVertical size={14} style={{ color: "#d1d5db", flexShrink: 0 }} />
        {item.image && <img src={`/uploads/gallery/${item.image}`} alt="" style={{ width: 44, height: 36, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 500, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", color: "#9ca3af", margin: 0 }}>{type} · {overlay || "bottom"} overlay · sort {sortOrder}</p>
        </div>
        {canDelete && (
          <button type="button" onClick={e => { e.stopPropagation(); handleDelete(); }} disabled={deleting}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 4, borderRadius: 6 }}>
            {deleting ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Trash2 size={14} />}
          </button>
        )}
        {expanded ? <ChevronUp size={14} style={{ color: "#9ca3af" }} /> : <ChevronDown size={14} style={{ color: "#9ca3af" }} />}
      </div>

      {expanded && canEdit && (
        <div style={{ padding: 14, background: "#fff", borderTop: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: 10 }}>
          <ImageUpload current={image ? `/uploads/gallery/${image}` : ""} target="gallery" label="Image" onDone={setImage} height={120} canEdit={canEdit} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label style={lbl}>Title *</label><input style={inp} value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div><label style={lbl}>Description</label><input style={inp} value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Lunch • Dinner" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: 8 }}>
            <div><label style={lbl}>Alt Text</label><input style={inp} value={alt} onChange={e => setAlt(e.target.value)} /></div>
            <div><label style={lbl}>Type</label>
              <select style={inp} value={type} onChange={e => setType(e.target.value)}>
                <option value="wide">Wide (2/3)</option>
                <option value="narrow">Narrow (1/3)</option>
              </select>
            </div>
            <div><label style={lbl}>Overlay</label>
              <select style={inp} value={overlay} onChange={e => setOverlay(e.target.value)}>
                <option value="">Bottom</option>
                <option value="top-aligned">Top</option>
              </select>
            </div>
            <div><label style={lbl}>Sort</label><input style={inp} type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={handleSave} disabled={saving}
              style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {saving ? <><Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Saving…</> : <><Save size={13}/> Save Item</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Item Form ────────────────────────────────────────────
function AddItemForm({ tabId, onItemAdded, canCreate }: {
  tabId: string;
  onItemAdded: (item: GalleryItem) => void;
  canCreate: boolean;
}) {
  const [show,    setShow]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [image,   setImage]   = useState("");
  const [title,   setTitle]   = useState("");
  const [desc,    setDesc]    = useState("");
  const [alt,     setAlt]     = useState("");
  const [type,    setType]    = useState("wide");
  const [overlay, setOverlay] = useState("");
  const [sort,    setSort]    = useState(0);

  async function handleAdd() {
    if (!canCreate) return;
    if (!image || !title) { alert("Image and title are required."); return; }
    setSaving(true);
    const fd = new FormData();
    fd.append("image", image); fd.append("alt", alt); fd.append("title", title);
    fd.append("description", desc); fd.append("type", type);
    fd.append("overlayClass", overlay); fd.append("sortOrder", String(sort));
    await addGalleryItem(tabId, fd);
    setSaving(false); setShow(false);
    onItemAdded({ _id: `temp-${Date.now()}`, image, alt, title, description: desc, type, overlayClass: overlay, sortOrder: sort });
    setImage(""); setTitle(""); setDesc(""); setAlt(""); setType("wide"); setOverlay(""); setSort(0);
  }

  if (!canCreate) return null;

  if (!show) return (
    <button type="button" onClick={() => setShow(true)}
      style={{ width: "100%", border: "2px dashed #e5e7eb", borderRadius: 10, padding: "12px", background: "none", cursor: "pointer", color: "#9ca3af", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#f97316"; e.currentTarget.style.color = "#f97316"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#9ca3af"; }}>
      <Plus size={15}/> Add Gallery Image
    </button>
  );

  return (
    <div style={{ border: "2px solid #f97316", borderRadius: 10, padding: 16, background: "#fff7ed" }}>
      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 700, color: "#f97316", marginBottom: 12 }}>New Image</p>
      <ImageUpload current="" target="gallery" label="Image *" onDone={setImage} height={120} canEdit={true} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <div><label style={lbl}>Title *</label><input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fresh Tomato Soup" /></div>
        <div><label style={lbl}>Description</label><input style={inp} value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Lunch • Dinner" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: 8, marginTop: 8 }}>
        <div><label style={lbl}>Alt Text</label><input style={inp} value={alt} onChange={e => setAlt(e.target.value)} /></div>
        <div><label style={lbl}>Type</label>
          <select style={inp} value={type} onChange={e => setType(e.target.value)}>
            <option value="wide">Wide (2/3)</option>
            <option value="narrow">Narrow (1/3)</option>
          </select>
        </div>
        <div><label style={lbl}>Overlay</label>
          <select style={inp} value={overlay} onChange={e => setOverlay(e.target.value)}>
            <option value="">Bottom</option>
            <option value="top-aligned">Top</option>
          </select>
        </div>
        <div><label style={lbl}>Sort</label><input style={inp} type="number" value={sort} onChange={e => setSort(Number(e.target.value))} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
        <button type="button" onClick={() => setShow(false)}
          style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", cursor: "pointer", color: "#6b7280" }}>
          Cancel
        </button>
        <button type="button" onClick={handleAdd} disabled={saving}
          style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "7px 18px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          {saving ? <><Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Saving…</> : <><Plus size={13}/> Add</>}
        </button>
      </div>
    </div>
  );
}

// ── Add Tab Form ─────────────────────────────────────────────
function AddTabForm({ existingCount, onTabCreated, onClose, canCreate }: {
  existingCount: number;
  onTabCreated: (tab: GalleryTab) => void;
  onClose: () => void;
  canCreate: boolean;
}) {
  const [label,     setLabel]     = useState("");
  const [tabKey,    setTabKey]    = useState("");
  const [sortOrder, setSortOrder] = useState(existingCount);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  if (!canCreate) return null;

  function handleLabelChange(val: string) {
    setLabel(val);
    setTabKey(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  }

  async function handleCreate() {
    if (!label.trim()) { setError("Tab label is required."); return; }
    if (!tabKey.trim()) { setError("Tab key is required."); return; }
    setSaving(true); setError("");
    const fd = new FormData();
    fd.append("tabKey",      tabKey.trim());
    fd.append("label",       label.trim());
    fd.append("bannerImage", "");
    fd.append("bannerAlt",   "");
    fd.append("sortOrder",   String(sortOrder));
    fd.append("isActive",    "true");
    const res = await upsertGalleryTab(fd);
    setSaving(false);
    if (res?.error) { setError(res.error); return; }
    const newTab: GalleryTab = {
      _id:         `temp-${Date.now()}`,
      tabKey:      tabKey.trim(),
      label:       label.trim(),
      bannerImage: "",
      bannerAlt:   "",
      isActive:    true,
      sortOrder,
      items:       [],
    };
    onTabCreated(newTab);
    onClose();
  }

  return (
    <div style={{ margin: "8px", padding: 14, border: "2px solid #f97316", borderRadius: 10, background: "#fff7ed" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 700, color: "#f97316", margin: 0 }}>New Tab</p>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={14}/></button>
      </div>

      {error && <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", color: "#dc2626", marginBottom: 8 }}>⚠ {error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <label style={{ ...lbl, marginBottom: 3 }}>Label *</label>
          <input style={inp} value={label} onChange={e => handleLabelChange(e.target.value)} placeholder="e.g. Desserts" autoFocus />
        </div>
        <div>
          <label style={{ ...lbl, marginBottom: 3 }}>Tab Key *</label>
          <input style={{ ...inp, fontFamily: "monospace", fontSize: "0.8rem" }} value={tabKey}
            onChange={e => setTabKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="e.g. desserts" />
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.68rem", color: "#9ca3af", margin: "3px 0 0" }}>
            Lowercase, no spaces. Auto-filled from label.
          </p>
        </div>
        <div>
          <label style={{ ...lbl, marginBottom: 3 }}>Sort Order</label>
          <input style={inp} type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button type="button" onClick={onClose}
          style={{ flex: 1, background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px", fontFamily: "DM Sans,sans-serif", fontSize: "0.8rem", cursor: "pointer", color: "#6b7280" }}>
          Cancel
        </button>
        <button type="button" onClick={handleCreate} disabled={saving}
          style={{ flex: 1, background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontFamily: "DM Sans,sans-serif", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          {saving ? <><Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> Creating…</> : <><Plus size={12}/> Create</>}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Main GalleryClient — all state managed locally, no router.refresh()
// ════════════════════════════════════════════════════════════
export default function GalleryClient({ tabs: initialTabs, perms }: { tabs: GalleryTab[]; perms?: Perms }) {
  const router = useRouter();
  const can = (action: string) => perms?.isSuperAdmin || Boolean(perms?.permissions?.gallery?.[action]);
  
  const canView = can("view");
  const canEdit = can("edit");
  const canDelete = can("delete");
  const canCreate = can("create");

  const [tabs,         setTabs]         = useState<GalleryTab[]>(initialTabs);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [savingTab,    setSavingTab]    = useState(false);
  const [deletingTab,  setDeletingTab]  = useState(false);
  const [showAddTab,   setShowAddTab]   = useState(false);

  const tab = tabs[activeTabIdx] ?? tabs[0] ?? null;

  const [bannerImage, setBannerImage] = useState(tab?.bannerImage || "");
  const [bannerAlt,   setBannerAlt]   = useState(tab?.bannerAlt   || "");
  const [label,       setLabel]       = useState(tab?.label       || "");

  function switchTab(idx: number) {
    setActiveTabIdx(idx);
    setBannerImage(tabs[idx]?.bannerImage || "");
    setBannerAlt(tabs[idx]?.bannerAlt     || "");
    setLabel(tabs[idx]?.label             || "");
  }

  // ── Tab CRUD — optimistic updates, no full page refresh ──
  function handleTabCreated(newTab: GalleryTab) {
    if (!canCreate) return;
    setTabs(prev => {
      const updated = [...prev, newTab];
      setActiveTabIdx(updated.length - 1);
      setBannerImage(""); setBannerAlt(""); setLabel(newTab.label);
      return updated;
    });
    router.refresh();
  }

  async function handleDeleteTab() {
    if (!canDelete) return;
    if (!tab) return;
    if (!confirm(`Delete tab "${tab.label}"?\n\nThis will also delete all ${tab.items.length} image(s). This cannot be undone.`)) return;
    setDeletingTab(true);
    await deleteGalleryTab(tab._id);
    setDeletingTab(false);
    setTabs(prev => {
      const updated = prev.filter((_, i) => i !== activeTabIdx);
      const newIdx = Math.min(activeTabIdx, updated.length - 1);
      setActiveTabIdx(Math.max(0, newIdx));
      if (updated[Math.max(0, newIdx)]) {
        setBannerImage(updated[Math.max(0, newIdx)].bannerImage || "");
        setBannerAlt(updated[Math.max(0, newIdx)].bannerAlt     || "");
        setLabel(updated[Math.max(0, newIdx)].label             || "");
      }
      return updated;
    });
    router.refresh();
  }

  async function handleToggleTab(id: string, current: boolean) {
    if (!canEdit) return;
    setTabs(prev => prev.map(t => t._id === id ? { ...t, isActive: !current } : t));
    await toggleGalleryTabActive(id, current);
  }

  async function handleSaveTab() {
    if (!canEdit) return;
    if (!tab) return;
    setSavingTab(true);
    const fd = new FormData();
    fd.append("tabKey",      tab.tabKey);
    fd.append("label",       label);
    fd.append("bannerImage", bannerImage);
    fd.append("bannerAlt",   bannerAlt);
    fd.append("sortOrder",   String(tab.sortOrder));
    fd.append("isActive",    String(tab.isActive));
    await upsertGalleryTab(fd);
    setSavingTab(false);
    setTabs(prev => prev.map((t, i) => i === activeTabIdx ? { ...t, label, bannerImage, bannerAlt } : t));
  }

  // ── Item CRUD — all optimistic ────────────────────────────
  function handleItemAdded(item: GalleryItem) {
    if (!canCreate) return;
    setTabs(prev => prev.map((t, i) =>
      i === activeTabIdx ? { ...t, items: [...t.items, item] } : t
    ));
    router.refresh();
  }

  function handleItemSaved(itemId: string, patch: Partial<GalleryItem>) {
    if (!canEdit) return;
    setTabs(prev => prev.map((t, i) =>
      i === activeTabIdx
        ? { ...t, items: t.items.map(it => it._id === itemId ? { ...it, ...patch } : it) }
        : t
    ));
  }

  function handleItemDeleted(itemId: string) {
    if (!canDelete) return;
    setTabs(prev => prev.map((t, i) =>
      i === activeTabIdx
        ? { ...t, items: t.items.filter(it => it._id !== itemId) }
        : t
    ));
  }

  if (!canView) {
    return (
      <div style={{ background: "#fff", borderRadius: 14, padding: 60, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <p style={{ fontFamily: "DM Sans,sans-serif", color: "#dc2626" }}>You don't have permission to view the gallery.</p>
      </div>
    );
  }

  if (tabs.length === 0) {
    return (
      <>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ background: "#fff", borderRadius: 14, padding: 60, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <ImageIcon size={40} style={{ color: "#d1d5db", margin: "0 auto 12px", display: "block" }} />
          <p style={{ fontFamily: "DM Sans,sans-serif", color: "#9ca3af", marginBottom: 16 }}>No gallery tabs yet. Create your first tab to get started.</p>
          {canCreate && (showAddTab
            ? <AddTabForm existingCount={0} onTabCreated={handleTabCreated} onClose={() => setShowAddTab(false)} canCreate={canCreate} />
            : <button type="button" onClick={() => setShowAddTab(true)}
                style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontFamily: "DM Sans,sans-serif", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={15}/> Create First Tab
              </button>
          )}
        </div>
      </>
    );
  }

  const sortedItems = tab ? [...tab.items].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── LEFT: Tab list ── */}
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6" }}>
            <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", margin: 0 }}>Gallery Tabs</p>
          </div>

          {tabs.map((t, i) => (
            <div key={t._id} onClick={() => switchTab(i)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", cursor: "pointer", borderBottom: "1px solid #f9fafb",
                background: i === activeTabIdx ? "#fff7ed" : "#fff",
                borderLeft: i === activeTabIdx ? "3px solid #f97316" : "3px solid transparent",
                transition: "all 0.13s" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.875rem", fontWeight: i === activeTabIdx ? 600 : 400, color: i === activeTabIdx ? "#f97316" : "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</p>
                <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.72rem", color: "#9ca3af", margin: 0 }}>{t.items.length} image{t.items.length !== 1 ? "s" : ""}</p>
              </div>
              {canEdit && (
                <button type="button" onClick={e => { e.stopPropagation(); handleToggleTab(t._id, t.isActive); }}
                  title={t.isActive ? "Active — click to deactivate" : "Inactive — click to activate"}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: t.isActive ? "#16a34a" : "#d1d5db" }}>
                  {t.isActive ? <Eye size={14}/> : <EyeOff size={14}/>}
                </button>
              )}
            </div>
          ))}

          {canCreate && (showAddTab ? (
            <AddTabForm existingCount={tabs.length} onTabCreated={handleTabCreated} onClose={() => setShowAddTab(false)} canCreate={canCreate} />
          ) : (
            <button type="button" onClick={() => setShowAddTab(true)}
              style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", borderTop: "1px solid #f3f4f6", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: "0.82rem", color: "#9ca3af", display: "flex", alignItems: "center", gap: 6 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
              onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}>
              <Plus size={14}/> Add New Tab
            </button>
          ))}
        </div>

        {/* ── RIGHT: Tab editor ── */}
        {tab && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Tab settings */}
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "1rem", fontWeight: 700, color: "#111827", margin: 0 }}>
                    Tab: <span style={{ color: "#f97316" }}>{tab.label}</span>
                  </p>
                  <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>Configure banner and label for this tab</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {canDelete && (
                    <button type="button" onClick={handleDeleteTab} disabled={deletingTab}
                      style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      {deletingTab ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Trash2 size={13}/>}
                      {deletingTab ? "Deleting…" : "Delete Tab"}
                    </button>
                  )}
                  {canEdit && (
                    <button type="button" onClick={handleSaveTab} disabled={savingTab}
                      style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontFamily: "DM Sans,sans-serif", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      {savingTab ? <><Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Saving…</> : <><Save size={13}/> Save Tab</>}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <ImageUpload key={`banner-${tab._id}`} current={bannerImage ? `/uploads/gallery/${bannerImage}` : ""} target="gallery"
                    label="Banner Image (shown at top when this tab is active)"
                    onDone={f => {
                      setBannerImage(f);
                      setTabs(prev => prev.map((t, i) => i === activeTabIdx ? { ...t, bannerImage: f } : t));
                    }} height={180} canEdit={canEdit} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={lbl}>Tab Label</label>
                    <input style={inp} value={label} onChange={e => canEdit && setLabel(e.target.value)} disabled={!canEdit} />
                  </div>
                  <div>
                    <label style={lbl}>Banner Alt Text</label>
                    <input style={inp} value={bannerAlt} onChange={e => canEdit && setBannerAlt(e.target.value)} disabled={!canEdit} />
                  </div>
                  <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 8 }}>
                    <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", color: "#6b7280", margin: 0 }}>
                      <strong>Tab key:</strong>{" "}
                      <code style={{ background: "#e5e7eb", padding: "2px 6px", borderRadius: 4 }}>{tab.tabKey}</code>
                    </p>
                    <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", color: "#6b7280", margin: "4px 0 0" }}>
                      <strong>Status:</strong>{" "}
                      <span style={{ color: tab.isActive ? "#16a34a" : "#9ca3af", fontWeight: 600 }}>{tab.isActive ? "Active" : "Inactive"}</span>
                      {canEdit && <span style={{ color: "#d1d5db" }}> — eye icon on left to toggle</span>}
                    </p>
                    <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", color: "#6b7280", margin: "4px 0 0" }}>
                      <strong>Images:</strong>{" "}
                      <span style={{ color: "#f97316", fontWeight: 600 }}>{tab.items.length}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gallery items */}
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "1rem", fontWeight: 700, color: "#111827", margin: 0 }}>Gallery Images</p>
                  <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>{sortedItems.length} image{sortedItems.length !== 1 ? "s" : ""} in this tab</p>
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {sortedItems.slice(0, 5).map(item => (
                    item.image ? <img key={item._id} src={`/uploads/gallery/${item.image}`} alt="" style={{ width: 32, height: 28, objectFit: "cover", borderRadius: 4 }} /> : null
                  ))}
                </div>
              </div>

              <div style={{ padding: 16 }}>
                {sortedItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 20px", color: "#d1d5db", fontFamily: "DM Sans,sans-serif" }}>
                    <ImageIcon size={32} style={{ margin: "0 auto 8px", display: "block" }} />
                    <p style={{ margin: 0, fontSize: "0.84rem" }}>No images yet — add the first one below</p>
                  </div>
                ) : (
                  sortedItems.map(item => (
                    <ItemRow key={item._id} item={item} tabId={tab._id}
                      onItemSaved={handleItemSaved}
                      onItemDeleted={handleItemDeleted}
                      canEdit={canEdit}
                      canDelete={canDelete} />
                  ))
                )}
                <div style={{ marginTop: 8 }}>
                  <AddItemForm tabId={tab._id} onItemAdded={handleItemAdded} canCreate={canCreate} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}