import { useState, useEffect } from 'react';
import { publicGet } from '../lib/api';

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
}

interface HomeMenuResponse {
  items: HomeMenuItem[];
  category: { _id: string; name: string } | null;
}

export function useHomeMenu() {
  const [items, setItems] = useState<HomeMenuItem[]>([]);
  const [category, setCategory] = useState<{ _id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const data = await publicGet<HomeMenuResponse>('/api/home-menu');
        if (!cancelled) {
          setItems(data.items ?? []);
          setCategory(data.category ?? null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load menu');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { items, category, loading, error };
}
