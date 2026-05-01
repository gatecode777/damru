import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import Cart from "@/models/Cart";
import MenuItem from "@/models/MenuItem";

// ── POST /api/cart/item — add item or increment qty ───────────
// Body: { menuItemId, variantType, custom, price, qty }
export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Login required to add to cart." }, { status: 401 });

  try {
    const { menuItemId, variantType, custom, price, qty = 1 } = await req.json();

    if (!menuItemId) return NextResponse.json({ error: "menuItemId required" }, { status: 400 });

    await connectDB();

    // Fetch item name + image from DB
    const menuItem = await MenuItem.findById(menuItemId).lean();
    if (!menuItem) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const name  = menuItem.name as string;
    const image = menuItem.image as string | undefined;

    // Unique key per item+variant combo
    const itemKey = `${menuItemId}-${custom || "plain"}`;

    let cart = await Cart.findOne({ userId: user.id });
    if (!cart) {
      cart = await Cart.create({ userId: user.id, items: [] });
    }

    const existingIdx = cart.items.findIndex(
      i => i.menuItemId.toString() === menuItemId && i.custom === (custom || "")
    );

    if (existingIdx >= 0) {
      // Already in cart — increment qty
      cart.items[existingIdx].qty += qty;
    } else {
      // Add new item
      cart.items.push({ menuItemId, name, image, variantType, custom: custom || "", price, qty });
    }

    await cart.save();
    return NextResponse.json({ success: true, items: cart.items });

  } catch (err) {
    console.error("POST cart/item error:", err);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}

// ── PATCH /api/cart/item — update qty of a single item ───────
// Body: { menuItemId, custom, qty }
export async function PATCH(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { menuItemId, custom, qty } = await req.json();
    await connectDB();

    const cart = await Cart.findOne({ userId: user.id });
    if (!cart) return NextResponse.json({ error: "Cart not found" }, { status: 404 });

    const idx = cart.items.findIndex(
      i => i.menuItemId.toString() === menuItemId && i.custom === (custom || "")
    );
    if (idx < 0) return NextResponse.json({ error: "Item not in cart" }, { status: 404 });

    if (qty < 1) {
      cart.items.splice(idx, 1); // remove
    } else {
      cart.items[idx].qty = qty;
    }

    await cart.save();
    return NextResponse.json({ success: true, items: cart.items });

  } catch (err) {
    console.error("PATCH cart/item error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// ── DELETE /api/cart/item — remove a single item ─────────────
// Body: { menuItemId, custom }
export async function DELETE(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { menuItemId, custom } = await req.json();
    await connectDB();

    const cart = await Cart.findOne({ userId: user.id });
    if (!cart) return NextResponse.json({ error: "Cart not found" }, { status: 404 });

    cart.items = cart.items.filter(
      i => !(i.menuItemId.toString() === menuItemId && i.custom === (custom || ""))
    ) as typeof cart.items;

    await cart.save();
    return NextResponse.json({ success: true, items: cart.items });

  } catch (err) {
    console.error("DELETE cart/item error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}