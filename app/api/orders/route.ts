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
// Body: { addressId?, paymentMethod, couponCode?, notes?, tableToken?, items? }
export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);

  try {
    const { addressId, paymentMethod = "cod", couponCode, notes = "", tableToken, items: bodyItems } = await req.json();

    // Check if we are doing a dine-in table order
    let isDineIn = false;
    let tableId: string | undefined;
    let tableNumber: string | undefined;

    if (tableToken) {
      const { verifyTableToken } = await import("@/lib/tableAuth");
      const validatedTable = await verifyTableToken(tableToken);
      if (!validatedTable) {
        return NextResponse.json({ error: "Invalid or expired table session. Please re-scan the table QR code." }, { status: 400 });
      }
      isDineIn = true;
      tableId = validatedTable.tableId;
      tableNumber = validatedTable.tableNumber;
    }

    if (!user && !isDineIn) {
      return NextResponse.json({ error: "Login required to place an order." }, { status: 401 });
    }

    if (!isDineIn && !addressId) {
      return NextResponse.json({ error: "Delivery address is required." }, { status: 400 });
    }

    await connectDB();

    // ── Fetch order items ──────────────────────────────────────
    let orderItems: any[] = [];
    if (user) {
      const cart = await Cart.findOne({ userId: user.id });
      if (!cart || cart.items.length === 0) {
        return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
      }
      orderItems = cart.items;
    } else {
      // Guest ordering at a table
      if (!bodyItems || bodyItems.length === 0) {
        return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
      }
      orderItems = bodyItems;
    }

    // ── Fetch address if not dine-in ───────────────────────────
    let address = null;
    if (!isDineIn && addressId) {
      address = await Address.findOne({ _id: addressId, userId: user?.id });
      if (!address) return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    // ── Calculate totals ──────────────────────────────────────
    const subtotal = orderItems.reduce((sum: number, i: { price: number; qty: number }) => sum + i.price * i.qty, 0);

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
    
    // Shipping charge is 0 for dine-in orders
    const shipping = isDineIn ? 0 : (subtotalAfterDiscount >= freeAbove ? 0 : flatCharge);
    const tax      = Math.round(subtotalAfterDiscount * taxRate / 100);
    const total    = subtotalAfterDiscount + tax + shipping;

    // ── Create order ──────────────────────────────────────────
    let orderId = generateOrderId();
    // Ensure unique orderId
    while (await Order.findOne({ orderId })) { orderId = generateOrderId(); }

    const orderData: any = {
      orderId,
      userId:    user ? user.id : undefined,
      userName:  user ? user.name : `Guest (Table ${tableNumber})`,
      userEmail: user ? user.email : undefined,
      items: orderItems.map((i: any) => ({
        menuItemId:  i.menuItemId,
        name:        i.name,
        image:       i.image,
        variantType: i.variantType,
        custom:      i.custom,
        price:       i.price,
        qty:         i.qty,
      })),
      subtotal, discount, couponCode: couponUsed,
      tax, shipping, total,
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
      status:        "confirmed",
      notes,
    };

    if (isDineIn) {
      orderData.tableId = tableId;
      orderData.tableNumber = tableNumber;
    } else if (address) {
      orderData.deliveryAddress = {
        label:    address.label,
        fullName: address.fullName,
        phone:    address.phone,
        house:    address.house,
        area:     address.area,
        city:     address.city,
        state:    address.state,
        pincode:  address.pincode,
      };
    }

    const order = await Order.create(orderData);

    // ── Clear cart for logged-in user ─────────────────────────
    if (user) {
      await Cart.findOneAndUpdate({ userId: user.id }, { items: [] });
    }

    return NextResponse.json({
      success: true,
      order: JSON.parse(JSON.stringify(order)),
    });

  } catch (err) {
    console.error("POST orders error:", err);
    return NextResponse.json({ error: "Failed to place order. Please try again." }, { status: 500 });
  }
}