import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import Table from "@/models/Table";
import jwt from "jsonwebtoken";

const SECRET = process.env.AUTH_SECRET || "damru-secret-key";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("tables", "view");
  if (deny) return deny;

  try {
    await connectDB();
    const table = await Table.findById(id).lean();
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
    return NextResponse.json({ table: JSON.parse(JSON.stringify(table)) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("tables", "edit");
  if (deny) return deny;

  try {
    await connectDB();
    const body = await req.json();
    const table = await Table.findById(id);
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

    const host = process.env.NEXTAUTH_URL || "http://localhost:3000";

    if (body.regenerateToken) {
      // Regenerate secure token & QR
      const qrToken = jwt.sign({ id: table._id }, SECRET);
      const menuUrl = `${host}/menu?t=${qrToken}`;
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`;

      table.qrToken = qrToken;
      table.qrImageUrl = qrImageUrl;
      await table.save();
    } else {
      // Update basic fields
      const { tableNumber, tableName, status } = body;

      if (tableNumber && tableNumber !== table.tableNumber) {
        // Check duplicate table number
        const duplicate = await Table.findOne({ tableNumber });
        if (duplicate) return NextResponse.json({ error: `Table "${tableNumber}" already exists` }, { status: 400 });
        table.tableNumber = tableNumber;
      }

      if (tableName !== undefined) table.tableName = tableName;
      if (status !== undefined) table.status = status;

      await table.save();
    }

    return NextResponse.json({ success: true, table: JSON.parse(JSON.stringify(table)) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update table" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("tables", "delete");
  if (deny) return deny;

  try {
    await connectDB();
    const table = await Table.findByIdAndDelete(id);
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete table" }, { status: 500 });
  }
}
