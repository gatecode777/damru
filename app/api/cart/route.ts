import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import Cart from "@/models/Cart";
import { resolveOrderItems } from "@/lib/checkout/resolveOrderItems";

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

// PUT /api/cart — atomically replace the authenticated cart. This is used at
// the checkout boundary so pricing never races a debounced sequence of item
// mutations. Names and prices are always resolved from active MenuItem records.
export async function PUT(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }

    await connectDB();
    const resolvedItems = await resolveOrderItems(body.items);
    const items = resolvedItems.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      image: item.image,
      variantType: item.variantType,
      custom: item.custom,
      price: item.price,
      qty: item.qty,
    }));
    const cart = await Cart.findOneAndUpdate(
      { userId: user.id },
      { $set: { items } },
      { upsert: true, new: true },
    ).lean();

    return NextResponse.json({ items: cart?.items ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to synchronize cart." },
      { status: 400 },
    );
  }
}
