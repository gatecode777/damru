import { useState, useEffect } from 'react';
import { publicGet } from '../lib/api';
import { API_URL } from '../config';

/* ── Content block types (mirrors IContentBlock in models/Blog.ts) ── */
export interface ContentBlock {
  type:
    | 'paragraph'
    | 'heading'
    | 'subheading'
    | 'quote'
    | 'callout'
    | 'bullet_list'
    | 'numbered_list'
    | 'image'
    | 'table'
    | 'divider';
  text?: string;
  items?: string[];
  imageFile?: string;
  imageAlt?: string;
  imageCaption?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
}

export interface BlogDetailAuthor {
  name: string;
  image: string;       // filename → resolveAuthorImage()
  designation: string;
  bio: string;
}

export interface BlogDetail {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;        // filename → resolveBlogImage()
  coverImageAlt: string;
  content: ContentBlock[];
  tags: string[];
  author: BlogDetailAuthor;
  category: string;
  readTime: number;
  views: number;
  publishedAt: string;       // ISO string
  createdAt: string;
}

export interface BlogSummary {
  _id: string;
  title: string;
  slug: string;
  coverImage: string;
  author: { name: string };
  publishedAt: string;
}

interface BlogDetailResponse {
  blog: BlogDetail;
  recent: BlogSummary[];
  prev: BlogSummary | null;
  next: BlogSummary | null;
}

/* ── Image resolvers ── */
export function resolveBlogImage(filename: string | undefined): string {
  if (!filename) return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800';
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_URL}/uploads/blogs/${filename.replace(/^\/+/, '')}`;
}

export function resolveAuthorImage(filename: string | undefined): string {
  if (!filename) return 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200';
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_URL}/uploads/authors/${filename.replace(/^\/+/, '')}`;
}

/**
 * Date format for blog detail page:
 * website uses toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })
 * Output: "July 27, 2026"
 */
export function fmtBlogDetailDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

/* ── Hook ── */
export function useBlogDetail(slug: string) {
  const query = useQuery({
    queryKey: queryKeys.blogs.detail(slug),
    queryFn: () => publicGet<BlogDetailResponse>(`/api/blogs/${encodeURIComponent(slug)}`),
    staleTime: 15 * 60 * 1000, // 15 minutes stale time
    enabled: !!slug,
  });

  return {
    blog:    query.data?.blog    ?? null,
    recent:  query.data?.recent  ?? [],
    prev:    query.data?.prev    ?? null,
    next:    query.data?.next    ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : (query.error ? String(query.error) : null),
  };
}
