"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";

export default function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const logoutStartedRef = useRef(false);

  useEffect(() => {
    if (pathname === "/admin/login") return;

    const originalFetch = window.fetch.bind(window);

    function expireSession() {
      if (logoutStartedRef.current) return;
      logoutStartedRef.current = true;

      // Navigate before awaiting any cleanup. A server action cannot delay the
      // expired-session UX or leave a sensitive admin screen visible.
      window.location.replace("/admin/login?reason=session_expired");
      void logoutAction().catch(() => undefined);
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

      if (
        response.status === 401 &&
        requestUrl.origin === window.location.origin &&
        requestUrl.pathname.startsWith("/api/admin/")
      ) {
        expireSession();
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [pathname]);

  return <>{children}</>;
}
