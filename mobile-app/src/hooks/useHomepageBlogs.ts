import { useState, useEffect } from 'react';
import { publicGet } from '../lib/api';
import { API_URL } from '../config';

/* ── Types ── */
export interface HomepageBlogAuthor {
  name: string;
  avatar: string;   // filename only — resolve with assetUrl("authors", avatar)
}

export interface HomepageBlog {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;       // filename only — resolve with assetUrl("blogs", coverImage)
  coverImageAlt: string;
  author: HomepageBlogAuthor;
  readTime: number;         // integer minutes
  publishedAt: string;      // ISO string
  category: string;         // category name or ""
}

interface HomepageBlogsResponse {
  blogs: HomepageBlog[];
}

/* ── Date formatter — exact port of website's fmtDate() ──
 * toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric", timeZone:"Asia/Kolkata" })
 * Output: "27 Apr 2026"
 */
export function fmtBlogDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return '';
  }
}

/* ── Image URL resolvers ── */
export function resolveBlogCover(filename: string): string | undefined {
  if (!filename) return undefined;
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_URL}/uploads/blogs/${filename.replace(/^\/+/, '')}`;
}

export function resolveAuthorAvatar(filename: string): string {
  if (!filename) return 'https://i.pravatar.cc/150?img=32';
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_URL}/uploads/authors/${filename.replace(/^\/+/, '')}`;
}

/* ── Hook ── */
export function useHomepageBlogs() {
  const [blogs, setBlogs]     = useState<HomepageBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchBlogs() {
      try {
        setLoading(true);
        setError(null);
        const data = await publicGet<HomepageBlogsResponse>('/api/homepage-blogs');
        if (!cancelled) {
          setBlogs(data.blogs ?? []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load blogs');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBlogs();
    return () => { cancelled = true; };
  }, []);

  return { blogs, loading, error };
}
