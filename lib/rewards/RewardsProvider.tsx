"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { RewardsDashboard } from "./rewardTypes";
import * as rewardApi from "./rewardApi";

interface RewardsContextType {
  dashboard: RewardsDashboard | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

const RewardsContext = createContext<RewardsContextType | null>(null);

export function RewardsProvider({ children }: { children: React.ReactNode }) {
  const [dashboard, setDashboard] = useState<RewardsDashboard | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const refresh = useCallback(async () => {
    try {
      const isLoggedIn = typeof document !== "undefined" && document.cookie.includes("damru_logged_in=true");
      if (!isLoggedIn) {
        setDashboard(null);
        setError("");
        setLoading(false);
        return;
      }
      const data = await rewardApi.getDashboard({ compact: true });
      if ("error" in data && data.error) {
        setDashboard(null);
        setError(data.error);
      } else {
        setDashboard(data);
        setError("");
      }
    } catch {
      setDashboard(null);
      setError("Could not load Damru rewards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(refresh);

    window.addEventListener("user-profile-updated", refresh);
    window.addEventListener("auth-state-changed", refresh);

    return () => {
      window.removeEventListener("user-profile-updated", refresh);
      window.removeEventListener("auth-state-changed", refresh);
    };
  }, [refresh]);

  return (
    <RewardsContext.Provider value={{ dashboard, loading, error, refresh }}>
      {children}
    </RewardsContext.Provider>
  );
}

export function useRewards() {
  const ctx = useContext(RewardsContext);
  if (!ctx) throw new Error("useRewards must be used within a RewardsProvider");
  return ctx;
}
