import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import BlogComment from "@/models/BlogComment";
import Blog from "@/models/Blog";

// GET /api/blog-comments?slug=xxx
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ comments: [] });
  try {
    await connectDB();
    const raw = await BlogComment.find({ blogSlug: slug, approved: true })
      .sort({ createdAt: 1 }).lean();
    const all = (raw as any[]).map(c => ({
      _id:      String(c._id),
      blogId:   String(c.blogId),
      blogSlug: c.blogSlug,
      userId:   c.userId || "",
      name:     c.name,
      email:    c.email,
      avatar:   c.avatar || "",
      comment:  c.comment,
      parentId: c.parentId ? String(c.parentId) : null,
      approved: c.approved,
      createdAt: c.createdAt,
    }));
    return NextResponse.json({ comments: all });
  } catch {
    return NextResponse.json({ comments: [] });
  }
}

// POST /api/blog-comments — requires login
export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Login required to comment." }, { status: 401 });

  try {
    const body = await req.json();
    const { blogSlug, comment, parentId } = body;

    if (!blogSlug || !comment?.trim())
      return NextResponse.json({ error: "Comment is required." }, { status: 400 });
    if (comment.length > 2000)
      return NextResponse.json({ error: "Comment too long (max 2000 chars)." }, { status: 400 });

    await connectDB();
    const blog = await Blog.findOne({ slug: blogSlug, status: "published" }).select("_id").lean();
    if (!blog) return NextResponse.json({ error: "Blog not found." }, { status: 404 });

    // Resolve parentId: must be valid 24-char hex string
    const resolvedParentId = (parentId && typeof parentId === "string" && /^[a-f0-9]{24}$/i.test(parentId.trim()))
      ? new mongoose.Types.ObjectId(parentId.trim())
      : null;

    const doc = await BlogComment.create({
      blogId:   (blog as any)._id,
      blogSlug,
      userId:   user.id,
      name:     user.name,
      email:    user.email,
      avatar:   user.avatar || "",
      comment:  comment.trim(),
      parentId: resolvedParentId,
      approved: true,
    });

    // Return normalized comment
    return NextResponse.json({
      success: true,
      comment: {
        _id:      String(doc._id),
        blogId:   String(doc.blogId),
        blogSlug: doc.blogSlug,
        userId:   doc.userId || "",
        name:     doc.name,
        email:    doc.email,
        avatar:   doc.avatar || "",
        comment:  doc.comment,
        parentId: doc.parentId ? String(doc.parentId) : null,
        approved: doc.approved,
        createdAt: doc.createdAt,
      }
    });
  } catch (e) {
    console.error("Comment POST error:", e);
    return NextResponse.json({ error: "Failed to post comment." }, { status: 500 });
  }
}