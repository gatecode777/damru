import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Blog from "@/models/Blog";
import BlogCategory from "@/models/BlogCategory";

// GET /api/blog-categories — all categories with blog counts
export async function GET() {
  try {
    await connectDB();
    const categories = await BlogCategory.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    // Count blogs per category
    const counts = await Blog.aggregate([
      { $match: { status: "published" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    counts.forEach((c: any) => { countMap[String(c._id)] = c.count; });
    const result = categories.map((cat: any) => ({
      _id: String(cat._id), name: cat.name, slug: cat.slug,
      count: countMap[String(cat._id)] || 0,
    }));
    return NextResponse.json({ categories: result });
  } catch {
    return NextResponse.json({ categories: [] });
  }
}