import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import Cart from "@/models/Cart";

// ── GET /api/cart — fetch user's cart ────────────────────────
export async function GET(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ items: [] }, { status: 401 });

  try {
    await connectDB();
    const cart = await Cart.findOne({ userId: user.id }).lean();
    return NextResponse.json({ items: cart?.items ?? [] });
  } catch (err) {
    console.error("GET cart error:", err);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}

// ── DELETE /api/cart — clear entire cart ─────────────────────
export async function DELETE(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    await Cart.findOneAndUpdate({ userId: user.id }, { items: [] }, { upsert: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE cart error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}