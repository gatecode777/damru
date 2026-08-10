"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Upload, X, ChevronDown, ChevronUp, Trash2, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/admin/Toast";

interface HallCard {
  _id?: string;
  title: string; subtitle: string; description: string;
  features: string[]; perfectFor: string[]; images: string[]; sortOrder: number;
}
interface EventType { label: string; image: string; }
export interface BranchData {
  _id?: string; name: string; slug: string; description: string;
  contact: string; timing: string; address: string;
  bannerImage: string; bannerAlt: string;
  cardImage: string; cardAlt: string;
  offerItems: string[]; whyChoose: string;
  eventTypes: EventType[]; hallCards: HallCard[];
  ctaTitle: string; ctaSubtitle: string;
  isActive: boolean; sortOrder: number;
}

export const EMPTY_BRANCH: BranchData = {
  name: "", slug: "", description: "", contact: "", timing: "11:00 AM – 11:00 PM", address: "",
  bannerImage: "", bannerAlt: "", cardImage: "", cardAlt: "",
  offerItems: [], whyChoose: "",
  eventTypes: [], hallCards: [],
  ctaTitle: "Plan Your Special Event",
  ctaSubtitle: "Fill in your details and let us make your celebration truly special.",
  isActive: true, sortOrder: 0,
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function uploadImg(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file); fd.append("target", "branch");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await res.json();
  if (d.filename) return d.filename;
  throw new Error(d.error || "Upload failed");
}

// ── Reusable sub-components ──────────────────────────────────────────────────

function ImgUpload({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try { onChange(await uploadImg(f)); } catch { alert("Upload failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {hint && <span className="field-hint">{hint}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
        {value && (
          <div style={{ position: "relative" }}>
            <img src={`/uploads/branches/${value}`} alt=""
              style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8, border: "1.5px solid #e5e7eb", display: "block" }} />
            <button type="button" onClick={() => onChange("")}
              style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, background: "#ef4444",
                border: "2px solid #fff", borderRadius: "50%", color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={10} />
            </button>
          </div>
        )}
        <div>
          <button type="button" className="btn-outline" onClick={() => ref.current?.click()} disabled={busy}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Upload size={13} />{busy ? "Uploading…" : value ? "Replace Image" : "Upload Image"}
          </button>
          <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={pick} />
        </div>
      </div>
    </div>
  );
}

function MultiImgUpload({ label, hint, values, onChange }: {
  label: string; hint?: string; values: string[]; onChange: (v: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setBusy(true);
    try { onChange([...values, ...await Promise.all(files.map(uploadImg))]); }
    catch { alert("Upload failed"); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {hint && <span className="field-hint">{hint}</span>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, alignItems: "flex-start" }}>
        {values.map((v, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={`/uploads/branches/${v}`} alt=""
              style={{ width: 100, height: 70, objectFit: "cover", borderRadius: 8, border: "1.5px solid #e5e7eb", display: "block" }} />
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))}
              style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, background: "#ef4444",
                border: "2px solid #fff", borderRadius: "50%", color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={10} />
            </button>
          </div>
        ))}
        <button type="button" className="btn-outline" onClick={() => ref.current?.click()} disabled={busy}
          style={{ display: "flex", alignItems: "center", gap: 6, alignSelf: "center" }}>
          <Upload size={13} />{busy ? "Uploading…" : "+ Add Images"}
        </button>
        <input ref={ref} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={pick} />
      </div>
    </div>
  );
}

function BulletsEditor({ label, hint, values, onChange, placeholder }: {
  label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {hint && <span className="field-hint">{hint}</span>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
        {values.map((v, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input className="inp" value={v} placeholder={placeholder || `Item ${i + 1}`}
              onChange={e => { const n = [...values]; n[i] = e.target.value; onChange(n); }} style={{ flex: 1 }} />
            <button type="button" className="btn-danger" style={{ padding: "7px 11px" }}
              onClick={() => onChange(values.filter((_, j) => j !== i))}>
              <X size={13} />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn-outline" style={{ display: "flex", alignItems: "center", gap: 5 }}
            onClick={() => onChange([...values, ""])}>
            <Plus size={13} /> Add Item
          </button>
        </div>
      </div>
    </div>
  );
}

function EventTypesEditor({ values, onChange }: { values: EventType[]; onChange: (v: EventType[]) => void }) {
  const [busyIdx, setBusyIdx] = useState(-1);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  async function pickImg(i: number, file: File) {
    setBusyIdx(i);
    try { const n = [...values]; n[i] = { ...n[i], image: await uploadImg(file) }; onChange(n); }
    catch { alert("Upload failed"); }
    finally { setBusyIdx(-1); }
  }
  return (
    <div className="field">
      <label className="field-label">Event Type Thumbnails</label>
      <span className="field-hint">Thumbnail images shown in the event types row on the branch page</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
        {values.map((ev, i) => (
          <div key={i} style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: 12, width: 140 }}>
            {ev.image
              ? <img src={`/uploads/branches/${ev.image}`} alt={ev.label}
                  style={{ width: "100%", height: 72, objectFit: "cover", borderRadius: 7, display: "block", marginBottom: 8 }} />
              : <div onClick={() => refs.current[i]?.click()}
                  style={{ width: "100%", height: 72, background: "#e5e7eb", borderRadius: 7, marginBottom: 8, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
                  <Upload size={16} style={{ color: "#9ca3af" }} />
                  <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 10, color: "#9ca3af" }}>Click to upload</span>
                </div>
            }
            <input className="inp" value={ev.label} placeholder="e.g. Birthday Parties"
              onChange={e => { const n = [...values]; n[i] = { ...n[i], label: e.target.value }; onChange(n); }}
              style={{ fontSize: 12, marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn-outline"
                style={{ flex: 1, justifyContent: "center", padding: "4px 8px", fontSize: 11 }}
                onClick={() => refs.current[i]?.click()} disabled={busyIdx === i}>
                {busyIdx === i ? "…" : <><Upload size={10} /> Img</>}
              </button>
              <button type="button" className="btn-danger" style={{ padding: "4px 8px" }}
                onClick={() => onChange(values.filter((_, j) => j !== i))}>
                <X size={11} />
              </button>
            </div>
            <input ref={el => { refs.current[i] = el; }} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) pickImg(i, f); }} />
          </div>
        ))}
        <button type="button" className="btn-outline"
          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5 }}
          onClick={() => onChange([...values, { label: "", image: "" }])}>
          <Plus size={13} /> Add Event Type
        </button>
      </div>
    </div>
  );
}

function HallCardEditor({ card, index, onChange, onDelete }: {
  card: HallCard; index: number; onChange: (c: HallCard) => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(true); // open by default when newly added
  function upd(k: keyof HallCard, v: any) { onChange({ ...card, [k]: v }); }
  return (
    <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <div onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", background: open ? "#fff7ed" : "#f9fafb",
          borderBottom: open ? "1.5px solid #fed7aa" : "none", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#f97316", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
            {index + 1}
          </span>
          <div>
            <div style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 14,
              color: card.title ? "#111827" : "#9ca3af" }}>
              {card.title || "New Hall Card — click to expand"}
            </div>
            {card.subtitle && <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#6b7280" }}>{card.subtitle}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={e => { e.stopPropagation(); onDelete(); }}
            className="btn-danger" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px" }}>
            <Trash2 size={12} /> Remove
          </button>
          {open ? <ChevronUp size={16} style={{ color: "#9ca3af" }} /> : <ChevronDown size={16} style={{ color: "#9ca3af" }} />}
        </div>
      </div>
      {/* Body */}
      {open && (
        <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16, background: "#fff" }}>
          <div className="field-row">
            <div className="field">
              <label className="field-label">Hall Title *</label>
              <input className="inp" value={card.title} placeholder="Birthday Party Hall"
                onChange={e => upd("title", e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Subtitle / Tagline</label>
              <input className="inp" value={card.subtitle} placeholder="Make Every Birthday Extra Special"
                onChange={e => upd("subtitle", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Description</label>
            <textarea className="inp-textarea" rows={3} value={card.description}
              placeholder="Describe what makes this hall special…"
              onChange={e => upd("description", e.target.value)} />
          </div>
          <div className="field-row">
            <BulletsEditor label="Features & Facilities" values={card.features}
              onChange={v => upd("features", v)} placeholder="e.g. Themed decoration options" />
            <BulletsEditor label="Perfect For (optional)" values={card.perfectFor}
              onChange={v => upd("perfectFor", v)} placeholder="e.g. Kids' Birthday Parties" />
          </div>
          <MultiImgUpload label="Hall Images" hint="Multiple images displayed in a grid beside the content"
            values={card.images} onChange={v => upd("images", v)} />
          <div className="field" style={{ maxWidth: 140 }}>
            <label className="field-label">Sort Order</label>
            <input className="inp" type="number" value={card.sortOrder}
              onChange={e => upd("sortOrder", parseInt(e.target.value) || 0)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Form ────────────────────────────────────────────────────────────────
export default function BranchForm({ initial }: { initial?: BranchData }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!initial?._id;
  const [data, setData] = useState<BranchData>(initial ?? EMPTY_BRANCH);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [section, setSection] = useState<"basic"|"content"|"halls">("basic");

  function upd(field: keyof BranchData, val: any) {
    setData(prev => ({ ...prev, [field]: val }));
  }

  async function handleSave() {
    if (!data.name.trim()) { setError("Branch name is required."); return; }
    if (!data.slug.trim()) { setError("Slug is required."); return; }
    setError(""); setSaving(true);
    try {
      const res = await fetch("/api/admin/branches", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: data._id, ...data } : data),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); toast.error("Unable to save branch"); return; }
      toast.success(isEdit ? "Branch updated" : "Branch created");
      router.push("/admin/branches");
      router.refresh();
    } catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  }

  const SECTIONS = [
    { key: "basic"   as const, label: "Basic Info" },
    { key: "content" as const, label: "Page Content" },
    { key: "halls"   as const, label: `Hall Cards (${data.hallCards.length})` },
  ];

  return (
    <div className="form-layout">
      <main className="form-main" style={{ maxWidth: 900 }}>

        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/admin/branches" className="breadcrumb-link" style={{ display: "flex", alignItems: "center", gap: 5, color: "#6b7280", textDecoration: "none", fontFamily: "DM Sans, sans-serif", fontSize: 13 }}>
            <ArrowLeft size={13} /> Branches
          </Link>
          <span className="breadcrumb-sep" style={{ color: "#d1d5db" }}>/</span>
          <span className="breadcrumb-current" style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#111827", fontWeight: 500 }}>
            {isEdit ? data.name : "New Branch"}
          </span>
        </div>

        {/* Page header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.4rem", color: "#111827", margin: "0 0 4px" }}>
              {isEdit ? `Edit: ${data.name}` : "New Branch"}
            </h1>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#6b7280", margin: 0 }}>
              {isEdit ? `/${data.slug}` : "Create a new branch location with all its details and hall cards"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Link href="/admin/branches" className="btn-cancel">Cancel</Link>
            <button className="btn-submit" onClick={handleSave} disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Save size={14} />{saving ? "Saving…" : isEdit ? "Save Changes" : "Create Branch"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert-error">
            <X size={14} /> {error}
          </div>
        )}

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #f3f4f6" }}>
          {SECTIONS.map(s => (
            <button key={s.key} type="button" onClick={() => setSection(s.key)}
              style={{ padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
                fontFamily: "DM Sans, sans-serif", fontSize: 13,
                fontWeight: section === s.key ? 600 : 400,
                color: section === s.key ? "#f97316" : "#6b7280",
                borderBottom: section === s.key ? "2.5px solid #f97316" : "2.5px solid transparent",
                marginBottom: -2 }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* ── BASIC INFO ── */}
        {section === "basic" && (
          <>
            <div className="form-card">
              <div className="form-card-header"><span className="form-card-title">Branch Details</span></div>
              <div className="form-card-body">
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Branch Name *</label>
                    <input className="inp" value={data.name} placeholder="Damru By Namo (Mansarovar, Jaipur)"
                      onChange={e => { upd("name", e.target.value); if (!isEdit) upd("slug", slugify(e.target.value)); }} />
                  </div>
                  <div className="field">
                    <label className="field-label">URL Slug *</label>
                    <span className="field-hint">Auto-generated from name · used in /branches/slug</span>
                    <input className="inp" value={data.slug} placeholder="mansarovar-jaipur"
                      onChange={e => upd("slug", slugify(e.target.value))} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Contact Number</label>
                    <input className="inp" value={data.contact} placeholder="+91 XXXXX XXXXX"
                      onChange={e => upd("contact", e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field-label">Timing</label>
                    <input className="inp" value={data.timing} placeholder="11:00 AM – 11:00 PM"
                      onChange={e => upd("timing", e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Full Address</label>
                  <input className="inp" value={data.address} placeholder="35 A Mansarovar, Jaipur, Rajasthan 302020"
                    onChange={e => upd("address", e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label">Short Description</label>
                  <span className="field-hint">Shown on the homepage &ldquo;Our Branches&rdquo; card — keep it 2–3 sentences</span>
                  <textarea className="inp-textarea" rows={3} value={data.description}
                    placeholder="Our Mansarovar branch offers a perfect blend of great food and a spacious banquet hall, ideal for birthdays, family gatherings, and small celebrations."
                    onChange={e => upd("description", e.target.value)} />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Sort Order</label>
                    <span className="field-hint">Lower number = appears first</span>
                    <input className="inp" type="number" value={data.sortOrder}
                      onChange={e => upd("sortOrder", parseInt(e.target.value) || 0)} style={{ maxWidth: 120 }} />
                  </div>
                  <div className="field" style={{ justifyContent: "flex-end" }}>
                    <div className="toggle-wrap" style={{ marginTop: 24 }}>
                      <input type="checkbox" id="branchActive" checked={data.isActive}
                        onChange={e => upd("isActive", e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: "#f97316", cursor: "pointer" }} />
                      <label htmlFor="branchActive" className="toggle-label" style={{ cursor: "pointer" }}>
                        Active — visible on website
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-card">
              <div className="form-card-header"><span className="form-card-title">Images</span></div>
              <div className="form-card-body">
                <div className="field-row">
                  <div>
                    <ImgUpload label="Card Image" value={data.cardImage} onChange={v => upd("cardImage", v)}
                      hint="Shown on homepage Our Branches grid" />
                    <div className="field" style={{ marginTop: 12 }}>
                      <label className="field-label">Card Image Alt Text</label>
                      <input className="inp" value={data.cardAlt} placeholder="Mansarovar branch interior"
                        onChange={e => upd("cardAlt", e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <ImgUpload label="Banner Image" value={data.bannerImage} onChange={v => upd("bannerImage", v)}
                      hint="Full-width hero on the branch detail page top" />
                    <div className="field" style={{ marginTop: 12 }}>
                      <label className="field-label">Banner Alt Text</label>
                      <input className="inp" value={data.bannerAlt} placeholder="Damru banquet hall dining area"
                        onChange={e => upd("bannerAlt", e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── PAGE CONTENT ── */}
        {section === "content" && (
          <>
            <div className="form-card">
              <div className="form-card-header"><span className="form-card-title">What We Offer</span></div>
              <div className="form-card-body">
                <BulletsEditor label="Offer Items" hint="Bullet points listing key facilities and services"
                  values={data.offerItems} onChange={v => upd("offerItems", v)}
                  placeholder="e.g. Fully air-conditioned banquet hall" />
              </div>
            </div>

            <div className="form-card">
              <div className="form-card-header"><span className="form-card-title">Why Choose Damru?</span></div>
              <div className="form-card-body">
                <div className="field">
                  <label className="field-label">Description Paragraph</label>
                  <textarea className="inp-textarea" rows={5} value={data.whyChoose}
                    placeholder="At Damru Banquet Hall, we focus on creating memorable experiences with premium service, beautiful ambience, and hassle-free event management. Whether it's an intimate gathering or a grand wedding celebration, our team ensures perfection in every detail."
                    onChange={e => upd("whyChoose", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="form-card">
              <div className="form-card-header"><span className="form-card-title">Event Types We Host</span></div>
              <div className="form-card-body">
                <EventTypesEditor values={data.eventTypes} onChange={v => upd("eventTypes", v)} />
              </div>
            </div>

            <div className="form-card">
              <div className="form-card-header"><span className="form-card-title">Call to Action (Bottom of Page)</span></div>
              <div className="form-card-body">
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">CTA Heading</label>
                    <input className="inp" value={data.ctaTitle} placeholder="Plan Your Special Event"
                      onChange={e => upd("ctaTitle", e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field-label">CTA Subheading</label>
                    <input className="inp" value={data.ctaSubtitle}
                      placeholder="Fill in your details and let us make your celebration truly special."
                      onChange={e => upd("ctaSubtitle", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── HALL CARDS ── */}
        {section === "halls" && (
          <div className="form-card">
            <div className="form-card-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="form-card-title">Hall &amp; Service Cards</span>
                <button type="button" className="btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 12 }}
                  onClick={() => upd("hallCards", [...data.hallCards, { title: "", subtitle: "", description: "", features: [], perfectFor: [], images: [], sortOrder: data.hallCards.length }])}>
                  <Plus size={13} /> Add Hall Card
                </button>
              </div>
            </div>
            <div className="form-card-body">
              {data.hallCards.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <MapPin size={28} style={{ color: "#d1d5db", marginBottom: 10 }} />
                  <p style={{ fontFamily: "DM Sans, sans-serif", color: "#9ca3af", fontSize: 13, marginBottom: 14 }}>
                    No hall cards yet. Add cards like &ldquo;Birthday Party Hall&rdquo;, &ldquo;Multi-Purpose Event Hall&rdquo;, etc.
                  </p>
                  <button type="button" className="btn-primary"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                    onClick={() => upd("hallCards", [{ title: "", subtitle: "", description: "", features: [], perfectFor: [], images: [], sortOrder: 0 }])}>
                    <Plus size={13} /> Add First Hall Card
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {data.hallCards.map((card, i) => (
                    <HallCardEditor key={i} card={card} index={i}
                      onChange={c => { const n = [...data.hallCards]; n[i] = c; upd("hallCards", n); }}
                      onDelete={() => upd("hallCards", data.hallCards.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom save bar */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingBottom: 40 }}>
          <Link href="/admin/branches" className="btn-cancel">Cancel</Link>
          <button className="btn-submit" onClick={handleSave} disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Save size={14} />{saving ? "Saving…" : isEdit ? "Save Changes" : "Create Branch"}
          </button>
        </div>

      </main>
    </div>
  );
}
