import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Fixed-window rate-limit counters. One document per (key, window) pair;
 * `expiresAt` carries a TTL index so exhausted windows self-clean without
 * a cron job. Never store raw secrets/tokens in `key` — callers should hash
 * or use only IPs/user/admin ids and route names.
 */
export interface IRateLimit extends Document {
  key: string;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
});

RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);

export default RateLimit;
