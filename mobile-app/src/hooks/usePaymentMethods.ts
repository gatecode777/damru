import { useQuery } from "@tanstack/react-query";

import { getPaymentMethods } from "@/services/paymentMethodsApi";
import { queryKeys } from "@/lib/queryClient";

export function usePaymentMethods() {
  return useQuery({
    queryKey: queryKeys.paymentMethods.all(),
    queryFn: getPaymentMethods,
    staleTime: Infinity,
  });
}
