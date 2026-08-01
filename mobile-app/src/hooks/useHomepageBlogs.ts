import { useQuery } from '@tanstack/react-query';
import { publicGet } from '../lib/api';
import { queryKeys } from '../lib/queryClient';
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
  const query = useQuery({
    queryKey: queryKeys.home.blogs(),
    queryFn: () => publicGet<HomepageBlogsResponse>('/api/homepage-blogs'),
    staleTime: 15 * 60 * 1000, // 15 minutes stale time
  });

  return {
    blogs: query.data?.blogs ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : (query.error ? String(query.error) : null),
    reload: query.refetch,
  };
}
