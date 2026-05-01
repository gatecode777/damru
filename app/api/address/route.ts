import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import Address from "@/models/Address";

// ── GET /api/address — fetch user's addresses ─────────────────
export async function GET(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ addresses: [] }, { status: 401 });

  try {
    await connectDB();
    const addresses = await Address.find({ userId: user.id }).sort({ isDefault: -1, createdAt: -1 }).lean();
    return NextResponse.json({ addresses: JSON.parse(JSON.stringify(addresses)) });
  } catch (err) {
    console.error("GET address error:", err);
    return NextResponse.json({ addresses: [] }, { status: 500 });
  }
}

// ── POST /api/address — create new address ────────────────────
export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  try {
    const { label, fullName, phone, house, area, city, state, pincode, isDefault } = await req.json();
    if (!fullName || !phone || !house || !city || !state || !pincode)
      return NextResponse.json({ error: "All required fields must be filled." }, { status: 400 });

    await connectDB();

    // If setting as default, unset all others first
    if (isDefault) {
      await Address.updateMany({ userId: user.id }, { isDefault: false });
    }

    const address = await Address.create({
      userId: user.id, label: label || "Home",
      fullName, phone, house, area: area || "",
      city, state, pincode, isDefault: !!isDefault,
    });

    return NextResponse.json({ address: JSON.parse(JSON.stringify(address)) });
  } catch (err) {
    console.error("POST address error:", err);
    return NextResponse.json({ error: "Failed to save address." }, { status: 500 });
  }
}

// ── PATCH /api/address — update an address ────────────────────
export async function PATCH(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, label, fullName, phone, house, area, city, state, pincode, isDefault } = await req.json();
    if (!id) return NextResponse.json({ error: "Address ID required." }, { status: 400 });

    await connectDB();

    // Ensure address belongs to this user
    const existing = await Address.findOne({ _id: id, userId: user.id });
    if (!existing) return NextResponse.json({ error: "Address not found." }, { status: 404 });

    if (isDefault) {
      await Address.updateMany({ userId: user.id }, { isDefault: false });
    }

    const updated = await Address.findByIdAndUpdate(
      id,
      { label, fullName, phone, house, area: area || "", city, state, pincode, isDefault: !!isDefault },
      { new: true }
    );

    return NextResponse.json({ address: JSON.parse(JSON.stringify(updated)) });
  } catch (err) {
    console.error("PATCH address error:", err);
    return NextResponse.json({ error: "Failed to update address." }, { status: 500 });
  }
}

// ── DELETE /api/address — delete an address ───────────────────
export async function DELETE(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    await connectDB();
    await Address.findOneAndDelete({ _id: id, userId: user.id });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE address error:", err);
    return NextResponse.json({ error: "Failed to delete address." }, { status: 500 });
  }
}