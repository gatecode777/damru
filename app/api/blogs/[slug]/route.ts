import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import BlogModel from "@/models/Blog";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * GET /api/blogs/:slug
 * Returns full blog detail + 3 recent posts + prev/next slugs.
 * Exact same queries as app/(website)/blogs/[slug]/page.tsx.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    await connectDB();

    const raw = await BlogModel.findOne({ slug, status: "published" })
      .populate("category", "name")
      .lean() as any;

    if (!raw) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
    }

    // Increment view count (fire-and-forget)
    BlogModel.findByIdAndUpdate(raw._id, { $inc: { views: 1 } }).catch(() => {});

    const blog = serialize(raw);

    // 3 recent posts (excluding current)
    const rawRecent = await BlogModel.find({
      status: "published",
      _id: { $ne: raw._id },
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(3)
      .select("title slug coverImage author publishedAt createdAt")
      .lean() as any[];

    const recent = rawRecent.map(serializeCompact);

    // Prev post (older than current)
    const publishedAt = raw.publishedAt ?? raw.createdAt;
    const rawPrev = await BlogModel.findOne({
      status: "published",
      publishedAt: { $lt: publishedAt },
    })
      .sort({ publishedAt: -1 })
      .select("title slug coverImage")
      .lean() as any;

    const rawNext = await BlogModel.findOne({
      status: "published",
      publishedAt: { $gt: publishedAt },
    })
      .sort({ publishedAt: 1 })
      .select("title slug coverImage")
      .lean() as any;

    return NextResponse.json(
      {
        blog,
        recent,
        prev: rawPrev ? serializeCompact(rawPrev) : null,
        next: rawNext ? serializeCompact(rawNext) : null,
      },
      { headers: CORS }
    );
  } catch (err) {
    console.error(`[/api/blogs/${slug}]`, err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: CORS }
    );
  }
}

function serialize(b: any) {
  return {
    _id:             String(b._id),
    title:           b.title ?? "",
    slug:            b.slug ?? "",
    excerpt:         b.excerpt ?? "",
    coverImage:      b.coverImage ?? "",
    coverImageAlt:   b.coverImageAlt ?? b.title ?? "",
    content:         b.content ?? [],
    tags:            b.tags ?? [],
    author: {
      name:        b.author?.name        ?? "Damru By Namo",
      image:       b.author?.image       ?? b.author?.avatar ?? "",
      designation: b.author?.designation ?? "",
      bio:         b.author?.bio         ?? "",
    },
    category:       b.category?.name ?? String(b.category ?? ""),
    readTime:       b.readTime ?? 1,
    views:          b.views ?? 0,
    publishedAt:    b.publishedAt ? String(b.publishedAt) : String(b.createdAt),
    createdAt:      String(b.createdAt),
  };
}

function serializeCompact(b: any) {
  return {
    _id:         String(b._id),
    title:       b.title ?? "",
    slug:        b.slug ?? "",
    coverImage:  b.coverImage ?? "",
    author: {
      name:  typeof b.author === "object" ? (b.author?.name ?? "Damru By Namo") : (b.author ?? "Damru By Namo"),
    },
    publishedAt: b.publishedAt ? String(b.publishedAt) : String(b.createdAt ?? ""),
  };
}
