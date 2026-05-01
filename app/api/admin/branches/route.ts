import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";

// GET all branches (admin)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const branches = await Branch.find().sort({ sortOrder: 1 }).lean();
    return NextResponse.json({ branches: JSON.parse(JSON.stringify(branches)) });
  } catch {
    return NextResponse.json({ branches: [] });
  }
}

// POST — create branch
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const body = await req.json();
    const branch = await Branch.create(body);
    return NextResponse.json({ branch: JSON.parse(JSON.stringify(branch)) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 400 });
  }
}

// PATCH — update branch
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const { id, ...updates } = await req.json();
    const branch = await Branch.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ branch: JSON.parse(JSON.stringify(branch)) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 400 });
  }
}

// DELETE — delete branch
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const { id } = await req.json();
    await Branch.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}