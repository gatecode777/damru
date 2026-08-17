import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Refreshes the currently mounted server queries without fetching inactive screens. */
export function useGlobalRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refreshing]);

  return { refreshing, onRefresh };
}
