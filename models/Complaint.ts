import mongoose, { Schema, Document, Model } from "mongoose";

export type ComplaintStatus = "open" | "in_progress" | "resolved" | "closed";

export interface IComplaint extends Document {
  userId:      mongoose.Types.ObjectId;
  userName:    string;
  userEmail:   string;
  issueType:   string;
  subject:     string;
  description: string;
  attachment:  string;   // filename in /uploads/complaints/
  status:      ComplaintStatus;
  adminNote:   string;   // admin's response/note
  createdAt:   Date;
  updatedAt:   Date;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName:    { type: String, required: true, trim: true },
    userEmail:   { type: String, required: true, trim: true },
    issueType:   { type: String, required: true, trim: true },
    subject:     { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    attachment:  { type: String, default: "" },
    status:      { type: String, enum: ["open","in_progress","resolved","closed"], default: "open" },
    adminNote:   { type: String, default: "" },
  },
  { timestamps: true }
);

ComplaintSchema.index({ userId: 1 });
ComplaintSchema.index({ status: 1 });
ComplaintSchema.index({ createdAt: -1 });

const Complaint: Model<IComplaint> =
  mongoose.models.Complaint ||
  mongoose.model<IComplaint>("Complaint", ComplaintSchema);

export default Complaint;