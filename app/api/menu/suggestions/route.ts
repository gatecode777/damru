import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MenuItem from "@/models/MenuItem";
import Order from "@/models/Order";

const LIMIT = 6;
const SELECT = "name description image basePrice variantType variants category isFeatured";

interface LeanMenuItem {
  _id: unknown;
  name: string;
  description?: string;
  image?: string;
  basePrice?: number;
  variants?: { price?: number }[];
  category?: { name?: string; slug?: string } | null;
  isFeatured?: boolean;
}

function serialize(item: LeanMenuItem) {
  let price = item.basePrice || 0;
  if (price === 0 && item.variants && item.variants.length > 0) {
    const prices = item.variants.map(v => v.price || 0).filter(p => p > 0);
    if (prices.length > 0) price = Math.min(...prices);
  }
  const catName = item.category?.name || "";
  const catSlug = item.category?.slug || catName.toLowerCase().replace(/\s+/g, "-");
  return {
    _id: String(item._id),
    name: item.name,
    desc: item.description || "",
    image: item.image || "",
    price,
    hasVariants: (item.variants?.length || 0) > 0,
    category: catName,
    catSlug,
    isFeatured: !!item.isFeatured,
  };
}

/**
 * GET /api/menu/suggestions
 * Curated picks for empty-state upsell spots (e.g. empty cart): admin-marked
 * featured items first, topped up with best-sellers computed from delivered
 * order line items, falling back to newest active items if the restaurant
 * has neither yet.
 */
export async function GET() {
  try {
    await connectDB();

    // The best-seller aggregate and the featured-items query are independent —
    // only the best-seller $in lookup below actually depends on the aggregate's result.
    const [bestSellerAgg, featured] = await Promise.all([
      Order.aggregate([
        { $match: { status: "delivered" } },
        { $unwind: "$items" },
        { $match: { "items.menuItemId": { $ne: null } } },
        { $group: { _id: "$items.menuItemId", qty: { $sum: "$items.qty" } } },
        { $sort: { qty: -1 } },
        { $limit: LIMIT },
      ]),
      MenuItem.find({ isActive: true, isFeatured: true })
        .populate("category", "name slug")
        .select(SELECT)
        .limit(LIMIT)
        .lean<LeanMenuItem[]>(),
    ]);
    const bestSellerIds = bestSellerAgg.map(b => b._id);

    const bestSellerDocs = bestSellerIds.length
      ? await MenuItem.find({ _id: { $in: bestSellerIds }, isActive: true })
          .populate("category", "name slug")
          .select(SELECT)
          .lean<LeanMenuItem[]>()
      : [];

    // Preserve best-seller rank order (Mongo $in doesn't guarantee it).
    const bestSellersRanked = bestSellerIds
      .map(id => bestSellerDocs.find(d => String(d._id) === String(id)))
      .filter((d): d is LeanMenuItem => Boolean(d));

    const seen = new Set<string>();
    const merged: LeanMenuItem[] = [];
    for (const item of [...featured, ...bestSellersRanked]) {
      const id = String(item._id);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
      if (merged.length >= LIMIT) break;
    }

    let finalItems: LeanMenuItem[] = merged;
    if (finalItems.length === 0) {
      finalItems = await MenuItem.find({ isActive: true })
        .populate("category", "name slug")
        .select(SELECT)
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .lean<LeanMenuItem[]>();
    }

    return NextResponse.json({ items: finalItems.map(serialize) });
  } catch (err) {
    console.error("Menu suggestions error:", err);
    return NextResponse.json({ items: [] });
  }
}
