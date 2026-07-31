import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import BlogModel from "@/models/Blog";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PAGE_SIZE = 9;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * GET /api/blogs
 * Returns a paginated list of published blogs.
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

    const total = await BlogModel.countDocuments({ status: "published" });
    const raw = await BlogModel.find({ status: "published" })
      .populate("category", "name")
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
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
      category:    b.category?.name ?? "Healthy Food",
    }));

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return NextResponse.json(
      {
        blogs,
        total,
        totalPages,
        page,
      },
      { headers: CORS }
    );
  } catch (err: any) {
    console.error("[/api/blogs]", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500, headers: CORS }
    );
  }
}
