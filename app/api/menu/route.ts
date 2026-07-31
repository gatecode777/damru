import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CategoryModel from "@/models/Category";
import MenuItemModel from "@/models/MenuItem";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    await connectDB();

    // Fetch all active categories
    const categories = await CategoryModel.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();

    // Fetch all active menu items
    const rawItems = await MenuItemModel.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();

    const items = rawItems.map((item: any) => {
      // Resolve display price
      let price = item.basePrice || 0;
      if (price === 0 && item.variants?.length > 0) {
        const prices = item.variants
          .map((v: any) => v.price || 0)
          .filter((p: number) => p > 0);
        if (prices.length > 0) price = Math.min(...prices);
      }

      return {
        _id: String(item._id),
        name: item.name,
        description: item.description || "",
        image: item.image || "",
        price,
        hasVariants: (item.variants?.length || 0) > 0,
        category: String(item.category),
        isVeg: item.isVeg !== false,
      };
    });

    return NextResponse.json(
      {
        categories: categories.map((c: any) => ({
          _id: String(c._id),
          name: c.name,
          slug: c.slug || "",
          description: c.description || "",
        })),
        items,
      },
      { headers: CORS }
    );
  } catch (error) {
    console.error("[/api/menu] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu data" },
      { status: 500, headers: CORS }
    );
  }
}
