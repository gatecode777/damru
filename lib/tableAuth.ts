import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import Table from "@/models/Table";
import { getRequiredSecret } from "@/lib/env";

export interface ValidatedTable {
  tableId: string;
  tableNumber: string;
  tableName?: string;
}

/**
 * Validates a table token by:
 * 1. Verifying the JWT signature.
 * 2. Finding the table in MongoDB.
 * 3. Comparing it against the table's active token stored in DB (invalidation check).
 */
export async function verifyTableToken(token: string): Promise<ValidatedTable | null> {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getRequiredSecret("AUTH_SECRET")) as { id?: string };
    if (!decoded || !decoded.id) return null;

    await connectDB();
    const table = await Table.findById(decoded.id).select("tableNumber tableName qrToken").lean();
    if (!table) return null;

    // Verify token matches the active token in the database.
    // If an administrator regenerated the token, this old token is invalid.
    if (table.qrToken !== token) return null;

    return {
      tableId: String(table._id),
      tableNumber: table.tableNumber,
      tableName: table.tableName,
    };
  } catch (err) {
    console.error("verifyTableToken error:", err);
    return null;
  }
}
