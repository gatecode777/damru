import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import GalleryTab from "@/models/GalleryTab";

export async function GET() {
  try {
    await connectDB();
    const tabs = await GalleryTab.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();
    return NextResponse.json({ tabs: JSON.parse(JSON.stringify(tabs)) });
  } catch (err) {
    console.error("Gallery API error:", err);
    return NextResponse.json({ tabs: [] }, { status: 500 });
  }
}