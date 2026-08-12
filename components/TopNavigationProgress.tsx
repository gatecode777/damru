"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const COMPLETE_DELAY_MS = 260;
const SAFETY_TIMEOUT_MS = 20000;
const SHELL_PROGRESS = 65;

export default function TopNavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const mounted = useRef(false);
  const activeRef = useRef(false);
  const runIdRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resourceCleanupRef = useRef<(() => void) | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const clearRun = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    resourceCleanupRef.current?.();
    hideTimerRef.current = null;
    safetyTimerRef.current = null;
    resourceCleanupRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (!activeRef.current) return;
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    resourceCleanupRef.current?.();
    safetyTimerRef.current = null;
    resourceCleanupRef.current = null;
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      activeRef.current = false;
      setVisible(false);
      setProgress(0);
      hideTimerRef.current = null;
    }, COMPLETE_DELAY_MS);
  }, []);

  const start = useCallback(() => {
    if (activeRef.current) return;
    clearRun();
    activeRef.current = true;
    runIdRef.current += 1;
    setVisible(true);
    setProgress(5);

    safetyTimerRef.current = setTimeout(finish, SAFETY_TIMEOUT_MS);
  }, [clearRun, finish]);

  const measurePageResources = useCallback(() => {
    if (!activeRef.current) return;
    const runId = runIdRef.current;
    resourceCleanupRef.current?.();
    setProgress((current) => Math.max(current, SHELL_PROGRESS));

    // Wait for the committed route to paint before collecting its resources.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!activeRef.current || runId !== runIdRef.current) return;

      const pendingImages = Array.from(document.images).filter(
        (image) => image.loading !== "lazy" && !image.complete,
      );
      const fontsPending = "fonts" in document && document.fonts.status !== "loaded";
      const total = pendingImages.length + (fontsPending ? 1 : 0);

      if (total === 0) {
        finish();
        return;
      }

      let completed = 0;
      let cancelled = false;
      const cleanups: Array<() => void> = [];

      const markComplete = () => {
        if (cancelled || runId !== runIdRef.current) return;
        completed += 1;
        const resourceProgress = SHELL_PROGRESS + (completed / total) * (100 - SHELL_PROGRESS);
        setProgress((current) => Math.max(current, resourceProgress));
        if (completed >= total) finish();
      };

      pendingImages.forEach((image) => {
        const done = () => {
          image.removeEventListener("load", done);
          image.removeEventListener("error", done);
          markComplete();
        };
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
        cleanups.push(() => {
          image.removeEventListener("load", done);
          image.removeEventListener("error", done);
        });
        // The resource may finish between collection and listener attachment.
        if (image.complete) done();
      });

      if (fontsPending) {
        document.fonts.ready.then(markComplete, markComplete);
      }

      resourceCleanupRef.current = () => {
        cancelled = true;
        cleanups.forEach((cleanup) => cleanup());
      };
    }));
  }, [finish]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    measurePageResources();
  }, [measurePageResources, routeKey]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (!event.defaultPrevented) start();
    }

    function handlePopState() {
      start();
    }

    function handleFallbackStart() {
      start();
    }

    function handleFallbackEnd() {
      measurePageResources();
    }

    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("damru:route-loading-start", handleFallbackStart);
    window.addEventListener("damru:route-loading-end", handleFallbackEnd);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("damru:route-loading-start", handleFallbackStart);
      window.removeEventListener("damru:route-loading-end", handleFallbackEnd);
      clearRun();
    };
  }, [clearRun, measurePageResources, start]);

  return (
    <div
      className={`top-navigation-progress${visible ? " top-navigation-progress--visible" : ""}`}
      role="progressbar"
      aria-label="Loading page"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <span className="top-navigation-progress__bar" style={{ width: `${progress}%` }} />
      <span className="top-navigation-progress__value">{Math.round(progress)}%</span>
    </div>
  );
}
