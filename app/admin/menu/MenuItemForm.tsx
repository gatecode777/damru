"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Save, Loader2, Plus, Trash2, ChevronRight, Upload, X, ImageOff } from "lucide-react";
import { createMenuItem, updateMenuItem } from "@/app/actions/menu";

interface Variant { label: string; price: number }

interface Category { _id: string; name: string }

interface MenuItem {
  _id: string; name: string; description?: string;
  basePrice: number; variantType: string;
  variants: Variant[]; isVeg: boolean;
  isActive: boolean; isFeatured: boolean;
  sortOrder: number; image?: string;
  category?: { _id: string; name: string } | null;
}

interface Props {
  categories: Category[];
  item?: MenuItem;
}

type VariantType = "none" | "portion" | "weight" | "pound" | "addon" | "custom";

// ── Preset variant templates (matching real restaurant use-cases) ────
const PRESETS: Record<string, { label: string; variants: Variant[] }> = {
  half_full: {
    label: "Half / Full (Curry)",
    variants: [
      { label: "Half", price: 120 },
      { label: "Full", price: 240 },
    ],
  },
  weight_gm: {
    label: "By Weight (100g–1Kg)",
    variants: [
      { label: "100gm", price: 120 },
      { label: "250gm", price: 300 },
      { label: "500gm", price: 600 },
      { label: "750gm", price: 780 },
      { label: "1Kg", price: 1200 },
    ],
  },
  cake_pound: {
    label: "Cake (1–5 Pound)",
    variants: [
      { label: "1 Pound", price: 120 },
      { label: "1.5 Pound", price: 300 },
      { label: "2 Pound", price: 600 },
      { label: "5 Pound", price: 780 },
    ],
  },
  pizza_size: {
    label: "Pizza (Small–Large)",
    variants: [
      { label: "Small", price: 199 },
      { label: "Medium", price: 299 },
      { label: "Large", price: 399 },
    ],
  },
  burger_addon: {
    label: "Burger Add-ons",
    variants: [
      { label: "Coke", price: 20 },
      { label: "French Fries", price: 100 },
      { label: "Choco Lava", price: 100 },
    ],
  },
};

const VARIANT_TYPE_INFO: Record<VariantType, { label: string; hint: string; icon: string }> = {
  none: { label: "Fixed Price", hint: "Single price — no customisation (e.g. Roti ₹30)", icon: "₹" },
  portion: { label: "Half / Full", hint: "Choose portion size (e.g. sabji, dal, curry)", icon: "🍛" },
  weight: { label: "By Weight", hint: "Price per weight — 100g, 250g, 500g, 1Kg (e.g. sweets)", icon: "⚖️" },
  pound: { label: "By Pound", hint: "Price per pound — 1lb, 1.5lb, 2lb, 5lb (e.g. cakes)", icon: "🎂" },
  addon: { label: "Add-ons", hint: "Optional extras with individual prices (e.g. fries, drink)", icon: "➕" },
  custom: { label: "Custom", hint: "Define your own labels and prices freely", icon: "✏️" },
};

export default function MenuItemForm({ categories, item }: Props) {
  const isEdit = !!item;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [variantType, setVariantType] = useState<VariantType>((item?.variantType as VariantType) || "none");
  const [variants, setVariants] = useState<Variant[]>(item?.variants || []);
  const [isVeg, setIsVeg] = useState(item?.isVeg ?? true);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(item?.isFeatured ?? false);

  const [imagePreview, setImagePreview] = useState<string | null>(
    item?.image ? `/uploads/menu-items/${item.image}` : null
  );
  const [imageFilename, setImageFilename] = useState<string>(item?.image || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Image upload ─────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    setUploadError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("target", "menuitem");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed.");
        setImagePreview(item?.image ? `/uploads/menu-items/${item.image}` : null);
      } else {
        setImageFilename(data.filename);
      }
    } catch {
      setUploadError("Upload failed. Please try again.");
      setImagePreview(item?.image ? `/uploads/menu-items/${item.image}` : null);
    } finally {
      setUploading(false);
    }
  }

  function removeImage() {
    setImagePreview(null);
    setImageFilename("");
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Variant helpers ──────────────────────────────────────────────
  function addVariant() {
    setVariants(v => [...v, { label: "", price: 0 }]);
  }

  function removeVariant(i: number) {
    setVariants(v => v.filter((_, idx) => idx !== i));
  }

  function updateVariant(i: number, field: "label" | "price", val: string) {
    setVariants(v => v.map((row, idx) =>
      idx === i ? { ...row, [field]: field === "price" ? Number(val) : val } : row
    ));
  }

  function applyPreset(key: string) {
    setVariants(PRESETS[key].variants.map(v => ({ ...v })));
  }

  function handleVariantTypeChange(t: VariantType) {
    setVariantType(t);
    // Auto-apply sensible preset
    if (t === "portion") applyPreset("half_full");
    else if (t === "weight") applyPreset("weight_gm");
    else if (t === "pound") applyPreset("cake_pound");
    else if (t === "addon") applyPreset("burger_addon");
    else if (t === "none") setVariants([]);
    // custom: keep current or start empty
    else if (t === "custom" && variants.length === 0) addVariant();
  }

  // ── Submit ───────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Validate variants
    if (variantType !== "none" && variants.length === 0) {
      setError("Please add at least one variant option.");
      return;
    }
    for (const v of variants) {
      if (!v.label.trim()) { setError("All variant labels must be filled."); return; }
      if (v.price < 0) { setError("Variant prices cannot be negative."); return; }
    }

    const fd = new FormData(e.currentTarget);
    fd.set("variantType", variantType);
    fd.set("variants", JSON.stringify(variants));
    fd.set("isVeg", String(isVeg));
    fd.set("isActive", String(isActive));
    fd.set("isFeatured", String(isFeatured));
    fd.set("image", imageFilename);
    if (isEdit) fd.set("oldImage", item.image || "");

    startTransition(async () => {
      const res = isEdit
        ? await updateMenuItem(item._id, fd)
        : await createMenuItem(fd);
      if (res?.error) setError(res.error);
    });
  }

  const needsVariants = variantType !== "none";

  // Add-ons are EXTRAS on top of the item's base price.
  // So for "addon" type: show BOTH base price AND the add-ons list.
  // For all other non-none types (portion/weight/pound/custom): hide base price, show variants only.
  const isAddon = variantType === "addon";
  const showBasePrice = !needsVariants || isAddon;

  return (
    <div className="form-layout">
      {/* Sticky header */}
      <div style={{ height: 60, borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", padding: "0 24px", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h1 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>
          {isEdit ? `Edit: ${item.name}` : "New Menu Item"}
        </h1>
      </div>

      <main className="form-main">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/admin/menu">Menu Items</Link>
          <ChevronRight size={12} className="breadcrumb-sep" />
          <span className="breadcrumb-current">{isEdit ? item.name : "New Item"}</span>
        </div>

        {error && <div className="alert-error"><span>⚠</span> {error}</div>}

        <form onSubmit={handleSubmit}>

          {/* ── Section 1: Basic Info ── */}
          <div className="form-card" style={{ marginBottom: 16 }}>
            <div className="form-card-header">
              <p className="form-card-title">Basic Information</p>
            </div>
            <div className="form-card-body">
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Item Name *</label>
                  <input name="name" defaultValue={item?.name} placeholder="e.g. Veg Burger" className="inp" required />
                </div>
                <div className="field">
                  <label className="field-label">Category *</label>
                  <select name="category" defaultValue={item?.category?._id || ""} className="inp-select" required>
                    <option value="">— Select Category —</option>
                    {categories.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="field-label">Description</label>
                <textarea
                  name="description"
                  defaultValue={item?.description}
                  placeholder="A short description shown on the menu card…"
                  className="inp-textarea"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* ── 2. Food Image ── */}
          <div className="form-card" style={{ marginBottom: 16 }}>
            <div className="form-card-header">
              <p className="form-card-title">Food Image</p>
              <p className="form-card-subtitle">Add an appetizing photo of your dish</p>
            </div>
            <div className="form-card-body">
              <div className="menu-img-container">
                {/* Upload Area */}
                <div
                  className={`upload-area ${imagePreview ? 'has-image' : ''}`}
                  onClick={() => !imagePreview && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />

                  {!imagePreview ? (
                    <div className="upload-placeholder">
                      <div className="upload-icon-wrapper">
                        <Upload size={32} strokeWidth={1.5} />
                      </div>
                      <p className="upload-title">Upload food image</p>
                      <p className="upload-subtitle">Click or drag & drop</p>
                      <div className="upload-formats">
                        <span>AVIF</span>
                        <span>WEBP</span>
                        <span>JPG</span>
                        <span>PNG</span>
                      </div>
                    </div>
                  ) : (
                    <div className="image-preview-wrapper">
                      <Image
                        src={imagePreview}
                        alt="Food preview"
                        fill
                        className="preview-image"
                        sizes="(max-width: 768px) 100vw, 300px"
                      />
                      {uploading && (
                        <div className="preview-overlay">
                          <Loader2 size={28} className="spin-icon" />
                          <span>Uploading...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons - only show if image exists or after upload */}
                {(imagePreview || uploading) && (
                  <div className="image-actions">
                    <button
                      type="button"
                      className="action-btn change-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload size={14} />
                      Change
                    </button>
                    <button
                      type="button"
                      className="action-btn remove-btn"
                      onClick={removeImage}
                      disabled={uploading}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                )}

                {/* Status Messages */}
                {uploading && (
                  <div className="status-message uploading">
                    <Loader2 size={14} className="spin-icon" />
                    Uploading your image...
                  </div>
                )}

                {uploadError && (
                  <div className="status-message error">
                    <span>⚠</span> {uploadError}
                  </div>
                )}

                {imageFilename && !uploading && !uploadError && (
                  <div className="status-message success">
                    <span>✓</span> Image saved: <code>{imageFilename}</code>
                  </div>
                )}

                {/* Info note */}
                <div className="image-info-note">
                  <span className="info-icon">💡</span>
                  <span>Recommended: Square image (800x800px) for best display. Max 3MB.</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Pricing Type ── */}
          <div className="form-card" style={{ marginBottom: 16 }}>
            <div className="form-card-header">
              <p className="form-card-title">Pricing Type</p>
            </div>
            <div className="form-card-body">

              {/* Type selector grid */}
              <div className="variant-type-grid">
                {(Object.keys(VARIANT_TYPE_INFO) as VariantType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`vtype-card${variantType === t ? " vtype-active" : ""}`}
                    onClick={() => handleVariantTypeChange(t)}
                  >
                    <span className="vtype-icon">{VARIANT_TYPE_INFO[t].icon}</span>
                    <span className="vtype-label">{VARIANT_TYPE_INFO[t].label}</span>
                  </button>
                ))}
              </div>

              {/* Hint for selected type */}
              <p className="vtype-hint">{VARIANT_TYPE_INFO[variantType].hint}</p>

              {/* Base price — fixed price OR addon (addon needs base price + addon list) */}
              {showBasePrice && (
                <div className="field" style={{ maxWidth: 200 }}>
                  <label className="field-label">Price (₹) *</label>
                  <input name="basePrice" type="number" min={0} defaultValue={item?.basePrice || 0} className="inp" required />
                  {isAddon && (
                    <span className="field-hint">Item base price — add-ons are charged on top</span>
                  )}
                </div>
              )}

              {/* Variant builder */}
              {needsVariants && (
                <div className="variants-section">
                  {/* Preset quick-fill chips */}
                  <div>
                    <p className="section-heading" style={{ marginBottom: 8 }}>Quick Fill Presets</p>
                    <div className="preset-row">
                      {Object.entries(PRESETS).map(([key, preset]) => (
                        <button key={key} type="button" className="preset-chip" onClick={() => applyPreset(key)}>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Column headers */}
                  <div className="variant-row-header" style={{ marginTop: 8 }}>
                    <span className="variant-col-label">Option Label</span>
                    <span className="variant-col-label">Price (₹)</span>
                    <span />
                  </div>

                  {/* Variant rows */}
                  {variants.map((v, i) => (
                    <div key={i} className="variant-row">
                      <input
                        type="text"
                        value={v.label}
                        onChange={e => updateVariant(i, "label", e.target.value)}
                        placeholder={variantType === "portion" ? "e.g. Half" : variantType === "weight" ? "e.g. 250gm" : variantType === "pound" ? "e.g. 1 Pound" : "Label"}
                        className="inp"
                      />
                      <input
                        type="number"
                        value={v.price}
                        min={0}
                        onChange={e => updateVariant(i, "price", e.target.value)}
                        placeholder="₹"
                        className="inp"
                      />
                      <button type="button" className="btn-remove-variant" onClick={() => removeVariant(i)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  <button type="button" className="btn-add-variant" onClick={addVariant}>
                    <Plus size={14} /> Add Option
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Section 3: Options & Meta ── */}
          <div className="form-card" style={{ marginBottom: 16 }}>
            <div className="form-card-header">
              <p className="form-card-title">Options &amp; Visibility</p>
            </div>
            <div className="form-card-body">
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Sort Order</label>
                  <input name="sortOrder" type="number" min={0} defaultValue={item?.sortOrder ?? 0} className="inp" />
                  <span className="field-hint">Lower = shown first within the category</span>
                </div>
              </div>

              {/* Toggle switches */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <ToggleRow label="Vegetarian" hint="Shows green veg dot on menu" checked={isVeg} onChange={setIsVeg} />
                <ToggleRow label="Active (visible on menu)" hint="Inactive items are hidden from customers" checked={isActive} onChange={setIsActive} />
                <ToggleRow label="Featured" hint="Highlighted in featured sections" checked={isFeatured} onChange={setIsFeatured} />
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="form-card">
            <div className="form-footer">
              <Link href="/admin/menu" className="btn-cancel">Cancel</Link>
              <div className="form-footer-actions">
                <button type="submit" disabled={isPending} className="btn-submit">
                  {isPending
                    ? <><Loader2 size={15} className="spin" /> Saving…</>
                    : <><Save size={15} /> {isEdit ? "Update Item" : "Create Item"}</>
                  }
                </button>
              </div>
            </div>
          </div>

        </form>
      </main>

      <style>{`
        
      `}</style>
    </div>
  );
}

// ── Small reusable toggle row ────────────────────────────────────────
function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-field-row">
      <div>
        <p style={{ fontSize: "0.875rem", color: "#111827", fontWeight: 400, marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: "0.74rem", color: "#9ca3af" }}>{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: "none",
          background: checked ? "#f97316" : "#e5e7eb",
          cursor: "pointer", position: "relative",
          transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 3,
          left: checked ? 22 : 3,
          width: 18, height: 18, background: "#fff",
          borderRadius: "50%", transition: "left 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        }} />
      </button>
    </div>
  );
}