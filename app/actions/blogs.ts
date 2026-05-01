"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import Blog from "@/models/Blog";

function toSlug(title: string) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function parseBlogFormData(formData: FormData) {
  const title         = (formData.get("title")         as string)?.trim();
  const excerpt       = (formData.get("excerpt")       as string)?.trim() || "";
  const categoryRaw   = (formData.get("category")      as string)?.trim() || "";
  const category      = categoryRaw || null;
  const tagsRaw       = (formData.get("tags")          as string)?.trim() || "";
  const status        = (formData.get("status")        as string) || "draft";
  const isFeatured    = formData.get("isFeatured") === "true";
  const sortOrder     = Number(formData.get("sortOrder")) || 0;
  const coverImage    = (formData.get("coverImage")    as string)?.trim() || "";
  const coverImageAlt = (formData.get("coverImageAlt") as string)?.trim() || "";
  const contentRaw    = (formData.get("content")       as string) || "[]";

  // Author
  const authorName        = (formData.get("authorName")        as string)?.trim() || "Damru Team";
  const authorImage       = (formData.get("authorImage")       as string)?.trim() || "";
  const authorDesignation = (formData.get("authorDesignation") as string)?.trim() || "";
  const authorBio         = (formData.get("authorBio")         as string)?.trim() || "";

  // SEO
  const seoTitle       = (formData.get("seoTitle")       as string)?.trim() || "";
  const seoDescription = (formData.get("seoDescription") as string)?.trim() || "";
  const seoKeywords    = (formData.get("seoKeywords")    as string)?.trim() || "";

  const tags    = tagsRaw ? tagsRaw.split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : [];
  let   content = [];
  try { content = JSON.parse(contentRaw); } catch { content = []; }

  return {
    title, excerpt, category, tags, status, isFeatured, sortOrder,
    coverImage, coverImageAlt, content,
    author: { name: authorName, image: authorImage, designation: authorDesignation, bio: authorBio },
    seo:    { metaTitle: seoTitle, metaDescription: seoDescription, metaKeywords: seoKeywords },
  };
}

// ── Create ───────────────────────────────────────────────────
export async function createBlog(formData: FormData) {
  await connectDB();
  const data = parseBlogFormData(formData);
  if (!data.title) return { error: "Title is required." };

  let slug = toSlug(data.title);
  const exists = await Blog.findOne({ slug });
  if (exists) slug = `${slug}-${Date.now()}`;

  try {
    await Blog.create({ ...data, slug,
      publishedAt: data.status === "published" ? new Date() : undefined,
    });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to create blog." };
  }

  revalidatePath("/admin/blogs");
  revalidatePath("/blogs");
  redirect("/admin/blogs"); // outside try-catch so NEXT_REDIRECT isn't caught
}

// ── Update ───────────────────────────────────────────────────
export async function updateBlog(id: string, formData: FormData) {
  await connectDB();
  const data = parseBlogFormData(formData);
  if (!data.title) return { error: "Title is required." };

  const existing = await Blog.findById(id);
  if (!existing) return { error: "Blog not found." };

  try {
    await Blog.findByIdAndUpdate(id, {
      ...data,
      publishedAt: !existing.publishedAt && data.status === "published"
        ? new Date()
        : existing.publishedAt,
    });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update blog." };
  }

  revalidatePath("/admin/blogs");
  revalidatePath("/blogs");
  revalidatePath(`/blogs/${existing.slug}`);
  redirect("/admin/blogs"); // outside try-catch so NEXT_REDIRECT isn't caught
}

// ── Delete ───────────────────────────────────────────────────
export async function deleteBlog(id: string) {
  await connectDB();
  try {
    await Blog.findByIdAndDelete(id);
    revalidatePath("/admin/blogs");
    revalidatePath("/blogs");
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete." };
  }
}

// ── Toggle status ────────────────────────────────────────────
export async function toggleBlogStatus(id: string, currentStatus: string) {
  await connectDB();
  const newStatus = currentStatus === "published" ? "draft" : "published";
  try {
    await Blog.findByIdAndUpdate(id, {
      status: newStatus,
      ...(newStatus === "published" ? { publishedAt: new Date() } : {}),
    });
    revalidatePath("/admin/blogs");
    revalidatePath("/blogs");
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to toggle status." };
  }
}