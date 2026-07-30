import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CategoryModel from "@/models/Category";
import MenuItemModel from "@/models/MenuItem";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * GET /api/home-menu
 * Returns the same menu items shown on the website homepage menu section:
 * - Shakes category (case-insensitive)
 * - isActive: true
 * - Sorted by sortOrder ascending
 * - Limited to 4
 */
export async function GET() {
  try {
    await connectDB();

    const shakesCat = await CategoryModel.findOne({
      name: /shakes?/i,
      isActive: true,
    }).lean() as any;

    if (!shakesCat) {
      return NextResponse.json({ items: [], category: null }, { headers: CORS });
    }

    const raw = await MenuItemModel.find({
      category: shakesCat._id,
      isActive: true,
    })
      .sort({ sortOrder: 1 })
      .limit(4)
      .lean() as any[];

    const items = raw.map((i) => ({
      _id: String(i._id),
      name: i.name,
      slug: i.slug || "",
      description: i.description || "",
      image: i.image || "",
      basePrice: i.basePrice || 0,
      isVeg: i.isVeg !== false,
      isFeatured: !!i.isFeatured,
      tags: i.tags || [],
      variantType: i.variantType || "none",
    }));

    return NextResponse.json(
      { items, category: { _id: String(shakesCat._id), name: shakesCat.name } },
      { headers: CORS }
    );
  } catch (error) {
    console.error("[/api/home-menu] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu items" },
      { status: 500, headers: CORS }
    );
  }
}
