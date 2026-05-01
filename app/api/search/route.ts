import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MenuItem from "@/models/MenuItem";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    await connectDB();
    const items = await MenuItem.find({
      isActive: true,
      $or: [
        { name:        { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ],
    })
      .populate("category", "name slug")
      .select("name description image basePrice variantType variants category")
      .limit(8)
      .lean();

    const results = (items as any[]).map((item) => {
      // Resolve display price — variant products have basePrice 0
      let price = item.basePrice || 0;
      if (price === 0 && item.variants?.length > 0) {
        const prices = item.variants
          .map((v: any) => v.price || 0)
          .filter((p: number) => p > 0);
        if (prices.length > 0) price = Math.min(...prices);
      }

      const catName = item.category?.name || "";
      const catSlug = item.category?.slug || catName.toLowerCase().replace(/\s+/g, "-");

      return {
        _id:         String(item._id),
        name:        item.name,
        desc:        item.description || "",
        image:       item.image || "",
        price,
        hasVariants: (item.variants?.length || 0) > 0,
        category:    catName,
        catSlug,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ results: [] });
  }
}