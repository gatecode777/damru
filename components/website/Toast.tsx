"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type WebsiteToastType = "success" | "error" | "info" | "warning";
export type ToastOptions = { id?: string; duration?: number };
type Description = string | undefined;

interface ToastItem {
  key: string;
  type: WebsiteToastType;
  title: string;
  description?: string;
  duration: number;
  exiting?: boolean;
}

export interface WebsiteToastApi {
  success: (title: string, description?: Description, options?: ToastOptions) => void;
  error: (title: string, description?: Description, options?: ToastOptions) => void;
  info: (title: string, description?: Description, options?: ToastOptions) => void;
  warning: (title: string, description?: Description, options?: ToastOptions) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<WebsiteToastApi | null>(null);
const DEFAULT_DURATIONS: Record<WebsiteToastType, number> = { success: 3600, info: 4000, warning: 5000, error: 5600 };
const MAX_VISIBLE = 4;
const VARIANTS = {
  success: { Icon: CheckCircle2, accent: "#15803d", soft: "#f0fdf4", label: "Success" },
  error: { Icon: XCircle, accent: "#dc2626", soft: "#fef2f2", label: "Error" },
  info: { Icon: Info, accent: "#2563eb", soft: "#eff6ff", label: "Information" },
  warning: { Icon: AlertTriangle, accent: "#e67e22", soft: "#fff7ed", label: "Warning" },
} as const;

export function WebsiteToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const sequence = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const exitTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer) clearTimeout(timer);
    timers.current.delete(key);
    setItems(current => current.map(item => item.key === key ? { ...item, exiting: true } : item));
    const previousExit = exitTimers.current.get(key);
    if (previousExit) clearTimeout(previousExit);
    exitTimers.current.set(key, setTimeout(() => {
      exitTimers.current.delete(key);
      setItems(current => current.filter(item => item.key !== key));
    }, 190));
  }, []);

  const push = useCallback((type: WebsiteToastType, title: string, description?: string, options?: ToastOptions) => {
    const key = options?.id?.trim() || `website-toast-${++sequence.current}`;
    const duration = options?.duration ?? DEFAULT_DURATIONS[type];
    const previousTimer = timers.current.get(key);
    if (previousTimer) clearTimeout(previousTimer);
    const previousExit = exitTimers.current.get(key);
    if (previousExit) { clearTimeout(previousExit); exitTimers.current.delete(key); }
    setItems(current => {
      const next = current.filter(item => item.key !== key);
      return [...next, { key, type, title, description, duration }].slice(-MAX_VISIBLE);
    });
    timers.current.set(key, setTimeout(() => remove(key), duration));
  }, [remove]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    for (const timer of exitTimers.current.values()) clearTimeout(timer);
    timers.current.clear();
    exitTimers.current.clear();
  }, []);

  const api = useMemo<WebsiteToastApi>(() => ({
    success: (title, description, options) => push("success", title, description, options),
    error: (title, description, options) => push("error", title, description, options),
    info: (title, description, options) => push("info", title, description, options),
    warning: (title, description, options) => push("warning", title, description, options),
    dismiss: remove,
  }), [push, remove]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="website-toast-stack" aria-live="polite" aria-relevant="additions">
        {items.map(item => {
          const variant = VARIANTS[item.type];
          const Icon = variant.Icon;
          return (
            <section key={item.key} className={`website-toast${item.exiting ? " website-toast--out" : ""}`} role={item.type === "error" ? "alert" : "status"} aria-label={variant.label} style={{ "--toast-accent": variant.accent, "--toast-soft": variant.soft, "--toast-duration": `${item.duration}ms` } as React.CSSProperties}>
              <span className="website-toast__icon"><Icon size={19} aria-hidden="true" /></span>
              <div className="website-toast__content"><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div>
              <button type="button" className="website-toast__close" onClick={() => remove(item.key)} aria-label={`Dismiss ${item.title}`}><X size={15} /></button>
              <span className="website-toast__progress" aria-hidden="true" />
            </section>
          );
        })}
      </div>
      <style>{`
        .website-toast-stack{position:fixed;top:max(18px,calc(env(safe-area-inset-top) + 12px));right:18px;z-index:2147483000;width:min(370px,calc(100vw - 32px));display:flex;flex-direction:column;gap:10px;pointer-events:none}
        .website-toast{--toast-accent:#e67e22;--toast-soft:#fff7ed;position:relative;display:flex;align-items:flex-start;gap:11px;overflow:hidden;padding:13px 34px 15px 13px;background:rgba(255,255,255,.98);border:1px solid #eee5dd;border-left:4px solid var(--toast-accent);border-radius:13px;box-shadow:0 16px 42px rgba(47,31,20,.18);font-family:Poppins,sans-serif;pointer-events:auto;animation:website-toast-in .24s cubic-bezier(.2,.8,.2,1)}
        .website-toast--out{animation:website-toast-out .19s ease forwards}
        .website-toast__icon{width:32px;height:32px;display:grid;place-items:center;flex:0 0 auto;border-radius:50%;color:var(--toast-accent);background:var(--toast-soft)}
        .website-toast__content{min-width:0;padding-top:1px}.website-toast__content strong{display:block;color:#1f2937;font-size:.88rem;line-height:1.35}.website-toast__content p{margin:3px 0 0;color:#6b7280;font-size:.78rem;line-height:1.48;overflow-wrap:anywhere}
        .website-toast__close{position:absolute;top:8px;right:7px;width:24px;height:24px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:#9ca3af;cursor:pointer}.website-toast__close:hover,.website-toast__close:focus-visible{background:#f3f4f6;color:#111827;outline:2px solid #fed7aa;outline-offset:1px}
        .website-toast__progress{position:absolute;left:0;bottom:0;height:3px;background:var(--toast-accent);animation:website-toast-progress var(--toast-duration) linear forwards}
        @keyframes website-toast-in{from{opacity:0;transform:translate3d(24px,-4px,0)}to{opacity:1;transform:none}}@keyframes website-toast-out{to{opacity:0;transform:translate3d(18px,0,0)}}@keyframes website-toast-progress{from{width:100%}to{width:0}}
        @media(max-width:600px){.website-toast-stack{top:max(12px,calc(env(safe-area-inset-top) + 8px));left:12px;right:12px;width:auto}.website-toast{border-radius:12px;padding-right:36px}}
        @media(prefers-reduced-motion:reduce){.website-toast,.website-toast--out,.website-toast__progress{animation:none}}
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): WebsiteToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within WebsiteToastProvider");
  return context;
}
