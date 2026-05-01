import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import { getSettings } from "@/lib/getSettings";
import Order from "@/models/Order";
import Cart from "@/models/Cart";
import Coupon from "@/models/Coupon";
import Address from "@/models/Address";

function generateOrderId(): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DMR-${dateStr}-${rand}`;
}

// ── GET /api/orders — user's order history ───────────────────
export async function GET(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ orders: [] }, { status: 401 });

  try {
    await connectDB();
    const orders = await Order.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ orders: JSON.parse(JSON.stringify(orders)) });
  } catch (err) {
    console.error("GET orders error:", err);
    return NextResponse.json({ orders: [] }, { status: 500 });
  }
}

// ── POST /api/orders — place a new order ─────────────────────
// Body: { addressId, paymentMethod, couponCode?, notes? }
// addressId is used to build deliveryAddress snapshot
export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Login required to place an order." }, { status: 401 });

  try {
    const { addressId, paymentMethod = "cod", couponCode, notes = "" } = await req.json();
    if (!addressId) return NextResponse.json({ error: "Delivery address is required." }, { status: 400 });

    await connectDB();

    // ── Fetch cart ────────────────────────────────────────────
    console.log("Placing order for user:", user.id, "with addressId:", addressId, "and couponCode:", couponCode);
    const cart = await Cart.findOne({ userId: user.id });
    if (!cart || cart.items.length === 0)
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });

    // ── Fetch address ─────────────────────────────────────────
    const address = await Address.findOne({ _id: addressId, userId: user.id });
    if (!address) return NextResponse.json({ error: "Address not found." }, { status: 404 });

    // ── Calculate totals ──────────────────────────────────────
    const subtotal = cart.items.reduce((sum: number, i: { price: number; qty: number }) => sum + i.price * i.qty, 0);

    // ── Validate coupon if provided ───────────────────────────
    let discount   = 0;
    let couponUsed = "";
    if (couponCode) {
      const now    = new Date();
      const coupon = await Coupon.findOne({ code: couponCode.trim().toUpperCase() });
      if (coupon && coupon.isActive &&
          (!coupon.expiryDate || now <= coupon.expiryDate) &&
          (!coupon.startDate  || now >= coupon.startDate) &&
          (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit) &&
          subtotal >= coupon.minOrderValue) {
        discount = coupon.type === "flat"
          ? Math.min(coupon.value, subtotal)
          : Math.min(
              (subtotal * coupon.value) / 100,
              coupon.maxDiscount !== null ? coupon.maxDiscount : Infinity
            );
        discount   = Math.round(discount);
        couponUsed = coupon.code;
        // Increment usedCount
        await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
      }
    }

    // Load dynamic tax/delivery settings from DB
    const siteSettings = await getSettings();
    const taxRate       = siteSettings.taxRate || 5;
    const freeAbove     = siteSettings.freeDeliveryAbove || 500;
    const flatCharge    = siteSettings.deliveryCharge || 50;
    const subtotalAfterDiscount = Math.max(0, subtotal - discount);
    const shipping = subtotalAfterDiscount >= freeAbove ? 0 : flatCharge;
    const tax      = Math.round(subtotalAfterDiscount * taxRate / 100);
    const total    = subtotalAfterDiscount + tax + shipping;

    // ── Create order ──────────────────────────────────────────
    let orderId = generateOrderId();
    // Ensure unique orderId
    while (await Order.findOne({ orderId })) { orderId = generateOrderId(); }

    const order = await Order.create({
      orderId,
      userId:    user.id,
      userName:  user.name,
      userEmail: user.email,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: cart.items.map((i: any) => ({
        menuItemId:  i.menuItemId,
        name:        i.name,
        image:       i.image,
        variantType: i.variantType,
        custom:      i.custom,
        price:       i.price,
        qty:         i.qty,
      })),
      deliveryAddress: {
        label:    address.label,
        fullName: address.fullName,
        phone:    address.phone,
        house:    address.house,
        area:     address.area,
        city:     address.city,
        state:    address.state,
        pincode:  address.pincode,
      },
      subtotal, discount, couponCode: couponUsed,
      tax, shipping, total,
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
      status:        "confirmed",
      notes,
    });

    // ── Clear cart after order placed ─────────────────────────
    await Cart.findOneAndUpdate({ userId: user.id }, { items: [] });

    return NextResponse.json({
      success: true,
      order: JSON.parse(JSON.stringify(order)),
    });

  } catch (err) {
    console.error("POST orders error:", err);
    return NextResponse.json({ error: "Failed to place order. Please try again." }, { status: 500 });
  }
}