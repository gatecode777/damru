"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { RewardsDashboard, RedeemResult } from "./rewardTypes";
import * as rewardApi from "./rewardApi";

interface RewardsContextType {
  dashboard: RewardsDashboard | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  redeem: (orderId: string, amount: number) => Promise<RedeemResult>;
}

const RewardsContext = createContext<RewardsContextType | null>(null);

export function RewardsProvider({ children }: { children: React.ReactNode }) {
  const [dashboard, setDashboard] = useState<RewardsDashboard | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await rewardApi.getDashboard();
      if ("error" in data && data.error) {
        setDashboard(null);
      } else {
        setDashboard(data);
      }
      setError("");
    } catch {
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

  const redeem = useCallback(async (orderId: string, amount: number): Promise<RedeemResult> => {
    const result = await rewardApi.redeemDamru(orderId, amount);
    if (result.success) await refresh();
    return result;
  }, [refresh]);

  return (
    <RewardsContext.Provider value={{ dashboard, loading, error, refresh, redeem }}>
      {children}
    </RewardsContext.Provider>
  );
}

export function useRewards() {
  const ctx = useContext(RewardsContext);
  if (!ctx) throw new Error("useRewards must be used within a RewardsProvider");
  return ctx;
}
