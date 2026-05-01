"use client";
import { Bell, Search } from "lucide-react";

export default function AdminHeader({ title }: { title?: string }) {
  return (
    <>
      <header className="hdr">
        <div className="hdr-left">
          {title && <h1 className="hdr-title">{title}</h1>}
        </div>
        <div className="hdr-right">
          {/* <div className="search">
            <Search size={14} className="search-ic" />
            <input placeholder="Search anything…" className="search-in" />
            <span className="kbd">⌘K</span>
          </div> */}
          {/* <button className="notif-btn" aria-label="Notifications">
            <Bell size={17} />
            <span className="notif-dot" />
          </button> */}
          <div className="user-chip">
            <div className="avatar">A</div>
            <div className="user-text">
              <span className="uname">Admin</span>
              <span className="urole">Super Admin</span>
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
        .search {
          display:flex; align-items:center; gap:8px;
          background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:9px;
          padding:7px 12px; width:220px; transition:border-color 0.15s;
        }
        .search:focus-within { border-color:#f97316; background:#fff; }
        .search-ic { color:#9ca3af; flex-shrink:0; }
        .search-in { flex:1; background:none; border:none; outline:none; font-family:'DM Sans',sans-serif; font-size:0.83rem; color:#374151; }
        .search-in::placeholder { color:#d1d5db; }
        .kbd { font-size:0.65rem; color:#9ca3af; background:#f3f4f6; border-radius:4px; padding:1px 5px; font-family:monospace; }
        .notif-btn {
          width:36px; height:36px; background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:9px;
          display:flex; align-items:center; justify-content:center; cursor:pointer; color:#6b7280;
          position:relative; transition:all 0.13s;
        }
        .notif-btn:hover { border-color:#f97316; color:#f97316; background:#fff7ed; }
        .notif-dot { position:absolute; top:8px; right:8px; width:7px; height:7px; background:#f97316; border-radius:50%; border:1.5px solid #fff; }
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
