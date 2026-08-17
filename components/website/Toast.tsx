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
  success: { Icon: CheckCircle2, accent: "#e67e22", soft: "#fff3e7", label: "Success" },
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
        .website-toast-stack{position:fixed;top:max(20px,calc(env(safe-area-inset-top) + 14px));right:20px;z-index:2147483000;width:min(390px,calc(100vw - 32px));display:flex;flex-direction:column;gap:12px;pointer-events:none}
        .website-toast{--toast-accent:#e67e22;--toast-soft:#fff3e7;position:relative;display:flex;align-items:center;gap:13px;overflow:hidden;min-height:72px;padding:14px 43px 16px 14px;background:linear-gradient(135deg,rgba(255,253,249,.99),rgba(255,248,240,.98));border:1px solid rgba(230,126,34,.22);border-radius:18px;box-shadow:0 18px 48px rgba(78,46,22,.14),0 3px 10px rgba(78,46,22,.07);font-family:Poppins,sans-serif;pointer-events:auto;isolation:isolate;animation:website-toast-in .34s cubic-bezier(.16,1,.3,1)}
        .website-toast::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:linear-gradient(180deg,#f4a261,var(--toast-accent));box-shadow:5px 0 18px color-mix(in srgb,var(--toast-accent) 18%,transparent)}
        .website-toast::after{content:"";position:absolute;z-index:-1;right:-28px;top:-40px;width:108px;height:108px;border:1px solid color-mix(in srgb,var(--toast-accent) 10%,transparent);border-radius:50%}
        .website-toast--out{animation:website-toast-out .2s cubic-bezier(.4,0,1,1) forwards}
        .website-toast__icon{width:38px;height:38px;display:grid;place-items:center;flex:0 0 auto;border:1px solid color-mix(in srgb,var(--toast-accent) 14%,transparent);border-radius:12px;color:var(--toast-accent);background:var(--toast-soft);box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}
        .website-toast__content{min-width:0}.website-toast__content strong{display:block;color:#332116;font-family:"Playfair Display",Georgia,serif;font-size:1rem;font-weight:700;line-height:1.3;letter-spacing:.01em}.website-toast__content p{margin:4px 0 0;color:#806b5d;font-size:.76rem;line-height:1.5;overflow-wrap:anywhere}
        .website-toast__close{position:absolute;top:10px;right:9px;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:#a28f82;cursor:pointer;transition:color .18s ease,background .18s ease,transform .18s ease}.website-toast__close:hover,.website-toast__close:focus-visible{background:#fff0e3;color:#b85f17;outline:2px solid rgba(230,126,34,.24);outline-offset:1px;transform:rotate(4deg)}
        .website-toast__progress{position:absolute;left:14px;right:14px;bottom:7px;height:2px;border-radius:999px;background:linear-gradient(90deg,#f4a261,var(--toast-accent));transform-origin:left center;animation:website-toast-progress var(--toast-duration) linear forwards}
        @keyframes website-toast-in{from{opacity:0;transform:translate3d(28px,-6px,0) scale(.97)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}@keyframes website-toast-out{to{opacity:0;transform:translate3d(22px,-2px,0) scale(.98)}}@keyframes website-toast-progress{from{transform:scaleX(1)}to{transform:scaleX(0)}}
        @media(max-width:600px){.website-toast-stack{display:none}}
        @media(prefers-reduced-motion:reduce){.website-toast,.website-toast--out{animation:none}.website-toast__progress{animation:none;transform:scaleX(0)}}
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): WebsiteToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within WebsiteToastProvider");
  return context;
}
