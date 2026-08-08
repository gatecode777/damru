import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { ApiRequestError } from "./api";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onSuccess: (data, query) => {
      if (__DEV__) {
        console.info(`[React Query Success] Key: ${JSON.stringify(query.queryKey)}`);
      }
    },
    onError: (error, query) => {
      if (__DEV__) {
        console.error(`[React Query Error] Key: ${JSON.stringify(query.queryKey)}, Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  }),
  mutationCache: new MutationCache({
    onSuccess: (data, variables, context, mutation) => {
      if (__DEV__) {
        console.info(`[React Query Mutation Success] Key: ${JSON.stringify(mutation.options.mutationKey)}`);
      }
    },
    onError: (error, variables, context, mutation) => {
      if (__DEV__) {
        console.error(`[React Query Mutation Error] Key: ${JSON.stringify(mutation.options.mutationKey)}, Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry 4xx (auth/validation) errors — retrying won't fix a bad request
        // or expired session, it just doubles the failed traffic and delays the error UI.
        if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 60_000, // Default 1 minute
      gcTime: 10 * 60_000, // Bounded garbage-collection time (10 minutes)
      refetchOnMount: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0, // Never retry mutations automatically (orders, payments, etc.)
    },
  },
});

export const queryKeys = {
  user: {
    me: () => ["user", "me"] as const,
  },
  home: {
    menu: () => ["home", "menu"] as const,
    branches: () => ["home", "branches"] as const,
    blogs: () => ["home", "blogs"] as const,
  },
  menu: {
    list: () => ["menu", "list"] as const,
  },
  gallery: {
    list: () => ["gallery", "list"] as const,
  },
  branches: {
    list: () => ["branches", "list"] as const,
  },
  blogs: {
    list: () => ["blogs", "list"] as const,
    search: (query: string) => ["blogs", "search", query] as const,
    detail: (slug: string) => ["blogs", "detail", slug] as const,
  },
  profile: {
    addresses: () => ["profile", "addresses"] as const,
    orders: () => ["profile", "orders"] as const,
    coupons: () => ["profile", "coupons"] as const,
    complaints: () => ["profile", "complaints"] as const,
    paymentMethods: () => ["profile", "paymentMethods"] as const,
  },
  rewards: {
    dashboard: () => ["rewards", "dashboard"] as const,
    history: (page: number) => ["rewards", "history", page] as const,
    coupons: () => ["rewards", "coupons"] as const,
    upcoming: () => ["rewards", "upcoming"] as const,
    achievements: () => ["rewards", "achievements"] as const,
    missions: () => ["rewards", "missions"] as const,
    referrals: () => ["rewards", "referrals"] as const,
  },
  checkout: {
    config: () => ["checkout", "config"] as const,
  },
};
