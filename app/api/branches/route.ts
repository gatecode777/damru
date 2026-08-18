import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";

// Public GET — all active branches
export async function GET() {
  try {
    await connectDB();
    const branches = await Branch.find({ isActive: true })
      .select("name slug description cardImage cardAlt bannerImage bannerAlt contact timing address latitude longitude sortOrder")
      .sort({ sortOrder: 1 })
      .lean();
    return NextResponse.json(
      { branches: JSON.parse(JSON.stringify(branches)) },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } }
    );
  } catch {
    return NextResponse.json({ branches: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
