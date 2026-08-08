import mongoose, { Schema, Document, Model } from "mongoose";

export type TableStatus = "available" | "occupied" | "reserved";

export interface ITable extends Document {
  tableNumber: string;
  tableName?: string;
  qrToken: string;
  qrImageUrl?: string;
  status: TableStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>(
  {
    tableNumber: { type: String, required: true, unique: true },
    tableName: { type: String },
    qrToken: { type: String, required: true, unique: true },
    qrImageUrl: { type: String },
    status: { type: String, enum: ["available", "occupied", "reserved"], default: "available" },
  },
  { timestamps: true }
);

TableSchema.index({ status: 1 });

if (mongoose.models.Table) {
  delete (mongoose.models as Record<string, unknown>).Table;
}
const Table: Model<ITable> = mongoose.model<ITable>("Table", TableSchema);

export default Table;
