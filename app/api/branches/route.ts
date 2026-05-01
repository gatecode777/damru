import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";

// Public GET — all active branches
export async function GET() {
  try {
    await connectDB();
    const branches = await Branch.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    return NextResponse.json({ branches: JSON.parse(JSON.stringify(branches)) });
  } catch {
    return NextResponse.json({ branches: [] });
  }
}