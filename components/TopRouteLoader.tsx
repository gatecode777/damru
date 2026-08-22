"use client";
import { useEffect } from "react";
/** Signals the persistent layout progress bar when a Next.js loading boundary is active. */
export default function TopRouteLoader() {
  useEffect(() => {
    window.dispatchEvent(new Event("damru:route-loading-start"));
    return () => {
      window.dispatchEvent(new Event("damru:route-loading-end"));
    };
  }, []);
  return <span className="sr-only" role="status">Loading page…</span>;
}
