import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import GalleryTab from "@/models/GalleryTab";
import { unstable_cache } from "next/cache";

const getCachedGalleryTabs = unstable_cache(async () => {
  await connectDB();
  const tabs = await GalleryTab.find({ isActive: true })
    .select("tabKey label bannerImage bannerAlt sortOrder items")
    .sort({ sortOrder: 1 })
    .lean();
  return JSON.parse(JSON.stringify(tabs));
}, ["public-gallery-tabs"], { revalidate: 300, tags: ["gallery"] });

export async function GET() {
  try {
    const tabs = await getCachedGalleryTabs();
    return NextResponse.json(
      { tabs },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    console.error("Gallery API error:", err);
    return NextResponse.json(
      { tabs: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
