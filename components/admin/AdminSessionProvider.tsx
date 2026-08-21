"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const logoutStartedRef = useRef(false);

  useEffect(() => {
    if (pathname === "/admin/login") return;

    const originalFetch = window.fetch.bind(window);

    function expireSession() {
      if (logoutStartedRef.current) return;
      logoutStartedRef.current = true;

      // A single server response clears every Auth.js cookie chunk and then
      // redirects. Going straight to /admin/login can bounce back to the
      // dashboard while a stale JWT cookie is still present.
      window.location.replace("/api/admin/session-expired");
    }

    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const response = await originalFetch(...args);
      const input = args[0];
      const rawUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
      const requestUrl = new URL(rawUrl, window.location.origin);

      if (response.status === 401 && requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith("/api/admin/")) {
        let payload: { code?: unknown; error?: unknown } = {};
        try {
          payload = await response.clone().json() as { code?: unknown; error?: unknown };
        } catch { /* non-JSON response is not enough evidence to destroy a session */ }
        if (payload.code === "SESSION_EXPIRED" || payload.error === "Unauthorized") {
          expireSession();
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [pathname]);

  return <>{children}</>;
}
