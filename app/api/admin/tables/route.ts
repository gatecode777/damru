import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import Table from "@/models/Table";
import jwt from "jsonwebtoken";

const SECRET = process.env.AUTH_SECRET || "damru-secret-key";

export async function GET() {
  const deny = await checkApiPerm("tables", "view");
  if (deny) return deny;

  try {
    await connectDB();
    const tables = await Table.find().sort({ tableNumber: 1 }).lean();
    return NextResponse.json({ tables: JSON.parse(JSON.stringify(tables)) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch tables" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = await checkApiPerm("tables", "create");
  if (deny) return deny;

  try {
    await connectDB();
    const body = await req.json();
    const host = process.env.NEXTAUTH_URL || "http://localhost:3000";

    if (body.bulk) {
      const { start = 1, count = 5, prefix = "Table " } = body;
      const createdTables = [];

      for (let i = 0; i < count; i++) {
        const num = start + i;
        const tableNumber = `${prefix}${num}`.trim();

        // Check if tableNumber already exists
        const exists = await Table.findOne({ tableNumber });
        if (exists) continue;

        // Create with placeholder qrToken
        const table = await Table.create({
          tableNumber,
          tableName: "",
          qrToken: `temp-${Math.random()}`,
          status: "available",
        });

        // Generate actual token & QR
        const qrToken = jwt.sign({ id: table._id }, SECRET);
        const menuUrl = `${host}/menu?t=${qrToken}`;
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`;

        table.qrToken = qrToken;
        table.qrImageUrl = qrImageUrl;
        await table.save();

        createdTables.push(table);
      }

      return NextResponse.json({
        success: true,
        count: createdTables.length,
        tables: JSON.parse(JSON.stringify(createdTables)),
      });
    } else {
      const { tableNumber, tableName, status = "available" } = body;
      if (!tableNumber) return NextResponse.json({ error: "Table number is required" }, { status: 400 });

      // Check duplicate
      const exists = await Table.findOne({ tableNumber });
      if (exists) return NextResponse.json({ error: `Table "${tableNumber}" already exists` }, { status: 400 });

      // Create with placeholder
      const table = await Table.create({
        tableNumber,
        tableName,
        qrToken: `temp-${Math.random()}`,
        status,
      });

      // Generate actual token & QR
      const qrToken = jwt.sign({ id: table._id }, SECRET);
      const menuUrl = `${host}/menu?t=${qrToken}`;
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`;

      table.qrToken = qrToken;
      table.qrImageUrl = qrImageUrl;
      await table.save();

      return NextResponse.json({ success: true, table: JSON.parse(JSON.stringify(table)) });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create table" }, { status: 400 });
  }
}
