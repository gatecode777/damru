"use client";
import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions/auth";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await loginAction(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="root">
      {/* Left panel — decorative */}
      <div className="left-panel">
        <div className="lp-inner">
          <div className="lp-logo">
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <ellipse cx="16" cy="9" rx="6" ry="8" stroke="#fff" strokeWidth="2.2" />
              <ellipse cx="16" cy="23" rx="6" ry="8" stroke="#fff" strokeWidth="2.2" />
              <line x1="10" y1="16" x2="22" y2="16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="16" cy="16" r="2.5" fill="#fff" />
            </svg>
            <span className="lp-brand">DAMRU</span>
          </div>
          <h2 className="lp-headline">Manage everything<br />from one place.</h2>
          <p className="lp-sub">Your all-in-one admin console for users, products, analytics and more.</p>
          <div className="lp-pills">
            {["Real-time Analytics", "User Management", "Order Tracking", "Secure & Fast"].map(t => (
              <span key={t} className="lp-pill">✓ {t}</span>
            ))}
          </div>
        </div>
        <div className="lp-art" />
      </div>

      {/* Right panel — form */}
      <div className="right-panel">
        <div className="form-card">
          <div className="form-top">
            <div className="form-icon"><ShieldCheck size={22} strokeWidth={1.8} /></div>
            <h1 className="form-title">Welcome back</h1>
            <p className="form-sub">Sign in to the Damru Admin Console</p>
          </div>

          <form onSubmit={handle} className="form">
            <div className="field">
              <label htmlFor="email" className="lbl">Email Address</label>
              <input id="email" name="email" type="email" required autoComplete="email"
                placeholder="admin@damru.com" className="inp" />
            </div>
            <div className="field">
              <label htmlFor="password" className="lbl">Password</label>
              <div className="pw-wrap">
                <input id="password" name="password" type={showPw ? "text" : "password"}
                  required autoComplete="current-password" placeholder="••••••••" className="inp inp-pw" />
                <button type="button" className="eye" onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="err-box">
                <span className="err-dot" />
                {error}
              </div>
            )}

            <button type="submit" disabled={isPending} className="submit">
              {isPending ? <><Loader2 size={16} className="spin" /> Verifying…</> : "Sign In to Dashboard →"}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .root{min-height:100vh;display:flex;font-family:'DM Sans',sans-serif;background:#fff}

        /* Left */
        .left-panel{
          width:460px;flex-shrink:0;
          background:linear-gradient(145deg,#f97316 0%,#c2410c 100%);
          position:relative;overflow:hidden;
          display:flex;align-items:center;justify-content:center;
          padding:3rem 3.5rem;
        }
        .lp-inner{position:relative;z-index:1}
        .lp-art{
          position:absolute;inset:0;
          background:
            radial-gradient(circle at 80% 20%,rgba(255,255,255,0.12) 0%,transparent 55%),
            radial-gradient(circle at 10% 80%,rgba(0,0,0,0.12) 0%,transparent 50%);
          pointer-events:none;
        }
        .lp-logo{display:flex;align-items:center;gap:12px;margin-bottom:2.5rem}
        .lp-brand{font-family:'DM Sans',sans-serif;font-size:1.5rem;font-weight:800;letter-spacing:0.15em;color:#fff}
        .lp-headline{font-family:'DM Sans',sans-serif;font-size:2rem;font-weight:700;color:#fff;line-height:1.25;margin-bottom:1rem}
        .lp-sub{font-size:0.95rem;color:rgba(255,255,255,0.75);line-height:1.6;margin-bottom:2rem;font-weight:300}
        .lp-pills{display:flex;flex-direction:column;gap:8px}
        .lp-pill{font-size:0.82rem;color:rgba(255,255,255,0.85);display:flex;align-items:center;gap:6px}

        /* Right */
        .right-panel{flex:1;display:flex;align-items:center;justify-content:center;padding:2rem;background:#f9fafb}
        .form-card{
          background:#fff;border-radius:20px;padding:2.75rem 2.25rem;
          width:100%;max-width:420px;
          box-shadow:0 8px 32px rgba(0,0,0,0.07),0 2px 8px rgba(0,0,0,0.04);
          border:1px solid #f3f4f6;
        }
        .form-top{margin-bottom:2rem}
        .form-icon{
          width:48px;height:48px;border-radius:13px;
          background:#fff7ed;border:1.5px solid #fed7aa;
          display:flex;align-items:center;justify-content:center;
          color:#f97316;margin-bottom:1.25rem;
        }
        .form-title{font-family:'DM Sans',sans-serif;font-size:1.5rem;font-weight:700;color:#111827;margin-bottom:0.375rem}
        .form-sub{font-size:0.875rem;color:#6b7280}

        .form{display:flex;flex-direction:column;gap:1.1rem}
        .field{display:flex;flex-direction:column;gap:6px}
        .lbl{font-size:0.8rem;font-weight:500;color:#374151;letter-spacing:0.01em}
        .inp{
          background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:9px;
          padding:10px 14px;color:#111827;font-family:'DM Sans',sans-serif;font-size:0.9rem;
          outline:none;transition:border-color 0.15s,box-shadow 0.15s,background 0.15s;
        }
        .inp::placeholder{color:#d1d5db}
        .inp:focus{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,0.1);background:#fff}
        .pw-wrap{position:relative}
        .inp-pw{width:100%;padding-right:42px}
        .eye{
          position:absolute;right:12px;top:50%;transform:translateY(-50%);
          background:none;border:none;color:#9ca3af;cursor:pointer;
          display:flex;align-items:center;transition:color 0.15s;
        }
        .eye:hover{color:#374151}

        .err-box{
          display:flex;align-items:center;gap:8px;
          background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
          padding:9px 12px;font-size:0.825rem;color:#dc2626;
        }
        .err-dot{width:6px;height:6px;background:#ef4444;border-radius:50%;flex-shrink:0}

        .submit{
          width:100%;background:linear-gradient(135deg,#f97316,#ea580c);
          color:#fff;border:none;border-radius:10px;
          padding:11px 20px;font-family:'DM Sans',sans-serif;font-size:0.9rem;font-weight:500;
          cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
          margin-top:4px;transition:opacity 0.15s,transform 0.15s,box-shadow 0.15s;
          box-shadow:0 4px 16px rgba(249,115,22,0.3);letter-spacing:0.01em;
        }
        .submit:hover:not(:disabled){opacity:0.93;transform:translateY(-1px);box-shadow:0 8px 24px rgba(249,115,22,0.35)}
        .submit:disabled{opacity:0.65;cursor:not-allowed}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin 0.8s linear infinite}

        .hint{margin-top:1.5rem;text-align:center;font-size:0.775rem;color:#9ca3af}
        .hint code{color:#f97316;font-family:monospace;font-size:0.8rem;background:#fff7ed;padding:1px 5px;border-radius:4px}

        @media(max-width:768px){
          .left-panel{display:none}
          .right-panel{background:#fff}
          .form-card{box-shadow:none;border:none;padding:2rem 1.25rem}
        }
      `}</style>
    </div>
  );
}
