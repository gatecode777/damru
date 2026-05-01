import mongoose, { Schema, Document, Model } from "mongoose";

export type ReservationStatus = "pending" | "confirmed" | "cancelled";

export interface IReservation extends Document {
  userId:    mongoose.Types.ObjectId;
  userName:  string;
  userEmail: string;
  userPhone: string;
  date:      string;   // "YYYY-MM-DD"
  time:      string;   // "6:00 pm"
  persons:   string;   // "2 Person"
  notes:     string;
  status:    ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName:  { type: String, required: true, trim: true },
    userEmail: { type: String, required: true, trim: true },
    userPhone: { type: String, default: "", trim: true },
    date:      { type: String, required: true },
    time:      { type: String, required: true },
    persons:   { type: String, required: true },
    notes:     { type: String, default: "", trim: true },
    status:    { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
  },
  { timestamps: true }
);

ReservationSchema.index({ userId: 1 });
ReservationSchema.index({ date: 1 });
ReservationSchema.index({ status: 1 });

const Reservation: Model<IReservation> =
  mongoose.models.Reservation ||
  mongoose.model<IReservation>("Reservation", ReservationSchema);

export default Reservation;