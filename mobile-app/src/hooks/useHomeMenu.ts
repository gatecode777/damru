import { useQuery } from '@tanstack/react-query';
import { publicGet } from '../lib/api';
import { queryKeys } from '../lib/queryClient';
import type { RewardBadge } from '../types';

export interface HomeMenuItem {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  basePrice: number;
  isVeg: boolean;
  isFeatured: boolean;
  tags: string[];
  variantType: string;
  rewardBadge?: RewardBadge | null;
}

interface HomeMenuResponse {
  items: HomeMenuItem[];
  category: { _id: string; name: string } | null;
}

export function useHomeMenu() {
  const query = useQuery({
    queryKey: queryKeys.home.menu(),
    queryFn: () => publicGet<HomeMenuResponse>('/api/home-menu'),
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
  });

  return {
    items: query.data?.items ?? [],
    category: query.data?.category ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : (query.error ? String(query.error) : null),
    reload: query.refetch,
  };
}
