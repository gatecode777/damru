import { NextResponse } from "next/server";
import { getPublicMenu } from "@/lib/menuData";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};
const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    const { categories, items } = await getPublicMenu();
    return NextResponse.json(
      {
        categories: categories.map(({ _id, name, slug, description }) => ({ _id, name, slug, description })),
        items: items.map(({ _id, name, description, image, price, hasVariants, category, isVeg }) => ({
          _id, name, description, image, price, hasVariants, category, isVeg,
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
