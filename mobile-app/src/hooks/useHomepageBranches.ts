import { useState, useEffect } from 'react';
import { publicGet } from '../lib/api';
import type { Branch } from '../types';

interface BranchesResponse {
  branches: Branch[];
}

export function useHomepageBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const data = await publicGet<BranchesResponse>('/api/branches');
        if (!cancelled) {
          // Sort by sortOrder ascending (the API should do this, but safe fallback)
          const sorted = (data.branches ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          setBranches(sorted);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load branches');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { branches, loading, error };
}
