import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import BlogModel from "@/models/Blog";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * GET /api/homepage-blogs
 * Returns the same 3 latest published blogs shown on the website homepage.
 * Exact same query as app/(website)/page.tsx lines 40-54.
 */
export async function GET() {
  try {
    await connectDB();

    const raw = await BlogModel.find({ status: "published" })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(3)
      .select("title slug excerpt coverImage coverImageAlt author readTime publishedAt createdAt category")
      .populate("category", "name")
      .lean() as any[];

    const blogs = raw.map((b) => ({
      _id:         String(b._id),
      title:       b.title ?? "",
      slug:        b.slug ?? "",
      excerpt:     b.excerpt ?? "",
      coverImage:  b.coverImage ?? "",
      coverImageAlt: b.coverImageAlt ?? b.title ?? "",
      author: {
        name:   b.author?.name   ?? "Damru By Namo",
        avatar: b.author?.image  ?? b.author?.avatar ?? "",
      },
      readTime:    b.readTime ?? 1,
      publishedAt: b.publishedAt ? String(b.publishedAt) : String(b.createdAt),
      category:    b.category?.name ?? "",
    }));

    return NextResponse.json({ blogs }, { headers: CORS });
  } catch (err) {
    console.error("[/api/homepage-blogs] Error:", err);
    return NextResponse.json({ blogs: [] }, { status: 500, headers: CORS });
  }
}
