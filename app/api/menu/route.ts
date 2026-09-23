import { NextResponse } from "next/server";
import { getPublicMenu } from "@/lib/menuData";
import { getRewardBadges } from "@/lib/rewards/earnRules";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};
// Short CDN window: the payload carries Damru reward badges, which follow
// admin rule changes. Menu data itself is still served from getPublicMenu's
// 5-minute server cache, so origin cost is unchanged.
const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    const { categories, items } = await getPublicMenu();
    const badges = await getRewardBadges(items);
    return NextResponse.json(
      {
        categories: categories.map(({ _id, name, slug, description }) => ({ _id, name, slug, description })),
        items: items.map(({ _id, name, description, image, price, hasVariants, category, isVeg }) => ({
          _id, name, description, image, price, hasVariants, category, isVeg,
          rewardBadge: badges.get(_id) ?? null,
        })),
      },
      { headers: { ...CORS, "Cache-Control": PUBLIC_CACHE } }
    );
  } catch (error) {
    console.error("[/api/menu] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu data" },
      { status: 500, headers: { ...CORS, "Cache-Control": "no-store" } }
    );
  }
}
