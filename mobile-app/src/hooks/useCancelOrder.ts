import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { post, getApiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type { Order } from "@/types";

type OrdersCache = { orders: Order[] };

/** Optimistically flips the order to "cancelled" in the shared orders cache, rolls
 *  back and alerts on failure. Shared by the orders list and the order detail screen
 *  so both stay in sync with one cancellation code path. */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      post<{ success: boolean; order: Order }>(`/api/orders/${id}/cancel`, { message: reason }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profile.orders() });
      const previous = queryClient.getQueryData<OrdersCache>(queryKeys.profile.orders());
      queryClient.setQueryData<OrdersCache | undefined>(queryKeys.profile.orders(), (old) =>
        old ? { orders: old.orders.map((o) => (o._id === id ? { ...o, status: "cancelled" } : o)) } : old
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.profile.orders(), context.previous);
      Alert.alert("Order not cancelled", getApiErrorMessage(err, "Unable to cancel this order. Please try again."));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.orders() });
    },
  });
}
