import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Blog from "@/models/Blog";
import BlogCategory from "@/models/BlogCategory";

// GET /api/blog-search?q=xxx — search published blogs
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });
  try {
    await connectDB();
    const regex = new RegExp(q, "i");
    const blogs = await Blog.find({
      status: "published",
      $or: [
        { title: regex },
        { excerpt: regex },
        { tags: regex },
      ],
    })
      .sort({ publishedAt: -1 })
      .limit(8)
      .select("title slug excerpt coverImage publishedAt createdAt readTime author")
      .lean();
    return NextResponse.json({ results: JSON.parse(JSON.stringify(blogs)) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}