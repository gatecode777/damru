"use client";

import { useState, useEffect } from "react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin:       "Admin",
  moderator:   "Moderator",
};

export default function AdminHeader({ title }: { title?: string }) {
  const [adminUser, setAdminUser] = useState<{ name: string; role: string }>({
    name: "Admin",
    role: "admin",
  });

  useEffect(() => {
    fetch("/api/admin/permissions", { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setAdminUser({
            name: data.name || "Admin",
            role: data.role || "admin",
          });
        }
      })
      .catch(() => {});
  }, []);

  const name  = adminUser.name || "Admin";
  const role  = adminUser.role || "admin";
  const label = ROLE_LABELS[role] ?? "Admin";

  // Avatar initials — first letter of first + last word
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="hdr">
        <div className="hdr-left">
          {title && <h1 className="hdr-title">{title}</h1>}
        </div>
        <div className="hdr-right">
          <div className="user-chip">
            <div className="avatar">{initials}</div>
            <div className="user-text">
              <span className="uname">{name}</span>
              <span className="urole">{label}</span>
            </div>
          </div>
        </div>
      </header>
      <style>{`
        .hdr {
          height: 60px; display:flex; align-items:center; justify-content:space-between;
          padding: 0 24px; background:#fff; border-bottom:1px solid #e5e7eb;
          position:sticky; top:0; z-index:30;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .hdr-title { font-family:'DM Sans',sans-serif; font-size:1.1rem; font-weight:700; color:#111827; }
        .hdr-right { display:flex; align-items:center; gap:10px; }
        .user-chip {
          display:flex; align-items:center; gap:9px; padding:6px 12px 6px 6px;
          background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:10px; cursor:pointer;
          transition:all 0.13s;
        }
        .user-chip:hover { border-color:#f97316; background:#fff7ed; }
        .avatar {
          width:30px; height:30px; border-radius:8px;
          background:linear-gradient(135deg,#f97316,#ea580c);
          display:flex; align-items:center; justify-content:center;
          font-family:'DM Sans',sans-serif; font-weight:700; font-size:0.8rem; color:#fff;
        }
        .user-text { display:flex; flex-direction:column; }
        .uname { font-family:'DM Sans',sans-serif; font-size:0.8rem; font-weight:600; color:#111827; line-height:1.2; }
        .urole { font-size:0.65rem; color:#9ca3af; }
      `}</style>
    </>
  );
}
