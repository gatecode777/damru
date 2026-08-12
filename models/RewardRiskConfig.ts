import mongoose, { Document, Model, Schema } from "mongoose";

export interface IRewardRiskConfig extends Document {
  key: "default";
  values: Record<string, unknown>;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RewardRiskConfigSchema = new Schema<IRewardRiskConfig>({
  key: { type: String, enum: ["default"], required: true, unique: true, default: "default" },
  values: { type: Schema.Types.Mixed, required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
}, { timestamps: true });

const RewardRiskConfig: Model<IRewardRiskConfig> =
  mongoose.models.RewardRiskConfig || mongoose.model<IRewardRiskConfig>("RewardRiskConfig", RewardRiskConfigSchema);

export default RewardRiskConfig;
