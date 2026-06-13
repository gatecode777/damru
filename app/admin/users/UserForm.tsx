"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Save, Loader2, Upload, X, Eye, EyeOff, ChevronRight, User } from "lucide-react";
import { createUser, updateUser } from "@/app/actions/users";

interface UserData {
  _id: string; name: string; email: string;
  phone?: string;
  status: string; totalSpend: number; avatar?: string;
}

interface Props { user?: UserData }

type Status = "active" | "inactive" | "suspended";

const STATUS_OPTIONS: { value: Status; label: string; cls: string; dot: string }[] = [
  { value: "active",    label: "Active",    cls: "active-sel",    dot: "#22c55e" },
  { value: "inactive",  label: "Inactive",  cls: "inactive-sel",  dot: "#9ca3af" },
  { value: "suspended", label: "Suspended", cls: "suspended-sel", dot: "#ef4444" },
];

export default function UserForm({ user }: Props) {
  const isEdit = !!user;
  const [isPending, startTransition] = useTransition();
  const [error,  setError]  = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>((user?.status as Status) || "active");

  // Avatar upload state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user?.avatar ? `/uploads/avatars/${user.avatar}` : null
  );
  const [avatarFilename, setAvatarFilename] = useState<string>(user?.avatar || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Avatar upload ──────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview instantly
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    setUploadError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed.");
        setAvatarPreview(user?.avatar ? `/uploads/avatars/${user.avatar}` : null);
      } else {
        setAvatarFilename(data.filename);
      }
    } catch {
      setUploadError("Upload failed. Please try again.");
      setAvatarPreview(user?.avatar ? `/uploads/avatars/${user.avatar}` : null);
    } finally {
      setUploading(false);
    }
  }

  function removeAvatar() {
    setAvatarPreview(null);
    setAvatarFilename("");
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Submit ─────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    fd.set("status",    status);
    fd.set("avatar",    avatarFilename);
    if (isEdit) fd.set("oldAvatar", user.avatar || "");

    const email = fd.get("email")?.toString().trim() || "";
    const phone = fd.get("phone")?.toString().trim() || "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    startTransition(async () => {
      const res = isEdit
        ? await updateUser(user._id, fd)
        : await createUser(fd);
      if (res?.error) setError(res.error);
    });
  }

  // Initials for placeholder
  const nameVal = user?.name || "";
  const initials = nameVal.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div className="form-layout">
      {/* Sticky top header */}
      <div style={{
        height: 60, borderBottom: "1px solid #e5e7eb", background: "#fff",
        display: "flex", alignItems: "center", padding: "0 24px",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
      }}>
        <h1 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>
          {isEdit ? `Edit: ${user.name}` : "Add New User"}
        </h1>
      </div>

      <main className="form-main">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/admin/users">Users</Link>
          <ChevronRight size={12} className="breadcrumb-sep" />
          <span className="breadcrumb-current">{isEdit ? user.name : "New User"}</span>
        </div>

        {error && <div className="alert-error"><span>⚠</span> {error}</div>}

        <form onSubmit={handleSubmit}>

          {/* ── Avatar upload card ── */}
          <div className="form-card" style={{ marginBottom: 16 }}>
            <div className="form-card-header">
              <p className="form-card-title">Profile Picture</p>
            </div>
            <div className="form-card-body">
              <div className="avatar-upload-section">
                {/* Preview */}
                <div className={`avatar-preview${avatarPreview ? " has-image" : ""}`}>
                  {avatarPreview ? (
                    <Image
                      src={avatarPreview}
                      alt="Avatar preview"
                      width={96}
                      height={96}
                      style={{ objectFit: "cover", borderRadius: 12, width: "100%", height: "100%" }}
                    />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "#d1d5db" }}>
                      <User size={32} />
                      {nameVal && (
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, fontFamily: "DM Sans, sans-serif", color: "#9ca3af" }}>{initials}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="avatar-upload-controls">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      className="upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Uploading…</>
                      ) : (
                        <><Upload size={14} /> {avatarPreview ? "Change Photo" : "Upload Photo"}</>
                      )}
                    </button>
                    {avatarPreview && (
                      <button type="button" onClick={removeAvatar} style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "#fef2f2", border: "1.5px solid #fecaca",
                        borderRadius: 8, padding: "7px 11px", color: "#dc2626",
                        cursor: "pointer", fontSize: "0.82rem", fontFamily: "DM Sans, sans-serif"
                      }}>
                        <X size={13} /> Remove
                      </button>
                    )}
                  </div>
                  <p className="upload-hint">
                    JPG, PNG or WEBP · Max 2MB<br />
                    The file is saved on the server. Only the filename is stored in MongoDB.
                  </p>
                  {uploadError && <p className="upload-error">⚠ {uploadError}</p>}
                  {avatarFilename && !uploading && !uploadError && (
                    <p className="upload-success">✓ Saved as <code style={{ background: "#f0fdf4", padding: "1px 5px", borderRadius: 4, fontSize: "0.76rem" }}>{avatarFilename}</code></p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Basic info ── */}
          <div className="form-card" style={{ marginBottom: 16 }}>
            <div className="form-card-header">
              <p className="form-card-title">Basic Information</p>
            </div>
            <div className="form-card-body">
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Full Name *</label>
                  <input name="name" defaultValue={user?.name} placeholder="e.g. Arjun Sharma" className="inp" required />
                </div>
                <div className="field">
                  <label className="field-label">Email Address *</label>
                  <input name="email" type="email" defaultValue={user?.email} placeholder="user@example.com" className="inp" required />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Phone Number</label>
                  <input name="phone" defaultValue={user?.phone} placeholder="e.g. 9876543210" className="inp"
                    maxLength={10}
                    onInput={e => {
                      const tgt = e.currentTarget;
                      tgt.value = tgt.value.replace(/\D/g, "").slice(0, 10);
                    }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Password ── */}
          <div className="form-card" style={{ marginBottom: 16 }}>
            <div className="form-card-header">
              <p className="form-card-title">
                {isEdit ? "Change Password" : "Set Password"}
              </p>
            </div>
            <div className="form-card-body">
              <div className="field" style={{ maxWidth: 360 }}>
                <label className="field-label">
                  Password {isEdit && <span style={{ color: "#9ca3af", fontWeight: 400 }}>(leave blank to keep current)</span>}
                </label>
                <div className="pw-wrap">
                  <input
                    name="password"
                    type={showPw ? "text" : "password"}
                    placeholder={isEdit ? "Enter new password…" : "Min. 6 characters"}
                    className="inp"
                    required={!isEdit}
                    minLength={6}
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="field-hint">Minimum 6 characters. Stored as bcrypt hash.</span>
              </div>
            </div>
          </div>

          {/* ── Account settings ── */}
          <div className="form-card" style={{ marginBottom: 16 }}>
            <div className="form-card-header">
              <p className="form-card-title">Account Settings</p>
            </div>
            <div className="form-card-body">
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Total Spend (₹)</label>
                  <input name="totalSpend" type="number" min={0} defaultValue={user?.totalSpend ?? 0} className="inp" />
                  <span className="field-hint">Lifetime spend amount</span>
                </div>
              </div>

              <div className="field">
                <label className="field-label">Account Status</label>
                <div className="status-selector">
                  {STATUS_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`status-option${status === opt.value ? ` ${opt.cls}` : ""}`}
                      onClick={() => setStatus(opt.value)}
                    >
                      <input type="radio" name="_status_ui" value={opt.value} checked={status === opt.value} onChange={() => setStatus(opt.value)} />
                      <span className="status-dot-sm" style={{ background: opt.dot }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <span className="field-hint">Suspended users cannot login</span>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="form-card">
            <div className="form-footer">
              <Link href="/admin/users" className="btn-cancel">Cancel</Link>
              <div className="form-footer-actions">
                <button type="submit" disabled={isPending || uploading} className="btn-submit">
                  {isPending
                    ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Saving…</>
                    : <><Save size={15} /> {isEdit ? "Update User" : "Create User"}</>
                  }
                </button>
              </div>
            </div>
          </div>

        </form>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
