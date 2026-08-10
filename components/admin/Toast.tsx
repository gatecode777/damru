"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANTS: Record<ToastType, { icon: typeof CheckCircle2; accent: string; iconBg: string; iconColor: string }> = {
  success: { icon: CheckCircle2, accent: "#16a34a", iconBg: "#f0fdf4", iconColor: "#16a34a" },
  error:   { icon: XCircle,      accent: "#dc2626", iconBg: "#fef2f2", iconColor: "#dc2626" },
  info:    { icon: Info,         accent: "#f97316", iconBg: "#fff7ed", iconColor: "#f97316" },
};

const DEFAULT_DURATION = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, title: string, message?: string) => {
    const id = nextId.current++;
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration: DEFAULT_DURATION }]);
    setTimeout(() => dismiss(id), DEFAULT_DURATION);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (title, message) => push("success", title, message),
    error:   (title, message) => push("error", title, message),
    info:    (title, message) => push("info", title, message),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="admin-toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map(t => {
          const v = VARIANTS[t.type];
          const Icon = v.icon;
          return (
            <div key={t.id} className="admin-toast" role={t.type === "error" ? "alert" : "status"} style={{ borderLeftColor: v.accent }} onClick={() => dismiss(t.id)}>
              <span className="admin-toast-icon" style={{ background: v.iconBg, color: v.iconColor }}>
                <Icon size={18} />
              </span>
              <div className="admin-toast-body">
                <p className="admin-toast-title">{t.title}</p>
                {t.message && <p className="admin-toast-message">{t.message}</p>}
              </div>
              <button
                type="button"
                className="admin-toast-close"
                onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
              <span className="admin-toast-bar" style={{ background: v.accent, animationDuration: `${t.duration}ms` }} />
            </div>
          );
        })}
      </div>

      <style>{`
        .admin-toast-stack {
          position: fixed; top: 76px; right: 20px; z-index: 100000;
          display: flex; flex-direction: column; gap: 10px;
          width: 320px; max-width: calc(100vw - 32px);
          pointer-events: none;
        }
        .admin-toast {
          position: relative; overflow: hidden;
          display: flex; align-items: flex-start; gap: 10px;
          background: #fff; border: 1px solid #e5e7eb; border-left: 3px solid;
          border-radius: 10px; padding: 12px 30px 14px 12px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.14);
          font-family: 'DM Sans', sans-serif;
          pointer-events: auto; cursor: pointer;
          animation: admin-toast-in 0.22s cubic-bezier(.4,0,.2,1);
        }
        .admin-toast-icon {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .admin-toast-body { flex: 1; min-width: 0; }
        .admin-toast-title { margin: 0; font-size: 0.86rem; font-weight: 700; color: #111827; line-height: 1.3; }
        .admin-toast-message { margin: 2px 0 0; font-size: 0.78rem; color: #6b7280; line-height: 1.35; }
        .admin-toast-close {
          position: absolute; top: 8px; right: 8px;
          width: 20px; height: 20px; border-radius: 6px; border: none;
          background: transparent; color: #9ca3af; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .admin-toast-close:hover { background: #f3f4f6; color: #111827; }
        .admin-toast-bar {
          position: absolute; left: 0; bottom: 0; height: 2px;
          animation: admin-toast-shrink linear forwards;
        }
        @keyframes admin-toast-in {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes admin-toast-shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
