import { useQuery } from '@tanstack/react-query';
import { publicGet } from '../lib/api';
import { queryKeys } from '../lib/queryClient';
import type { Branch } from '../types';

interface BranchesResponse {
  branches: Branch[];
}

export function useHomepageBranches() {
  const query = useQuery({
    queryKey: queryKeys.home.branches(),
    queryFn: () => publicGet<BranchesResponse>('/api/branches'),
    staleTime: 15 * 60 * 1000, // 15 minutes stale time
    select: (data) => {
      return (data.branches ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    },
  });

  return {
    branches: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : (query.error ? String(query.error) : null),
    reload: query.refetch,
  };
}
