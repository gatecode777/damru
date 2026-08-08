import { connectDB } from "@/lib/mongodb";
import ReferralConfig, { IReferralConfig, ReferralQualificationEvent } from "@/models/ReferralConfig";

export type ReferralConfigValues = {
  isActive: boolean;
  referrerRewardDamru: number;
  referredUserRewardDamru: number;
  qualificationEvent: ReferralQualificationEvent;
  minimumOrderAmount: number;
  rewardDelayDays: number;
  maximumSuccessfulReferralsPerUser: number | null;
  codePrefix: string;
  codeLength: number;
  requireEmailVerified: boolean;
  requireMobileVerified: boolean;
  allowExistingUserReferralCodeEntry: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

const DEFAULTS: ReferralConfigValues = {
  isActive: true,
  referrerRewardDamru: 500,
  referredUserRewardDamru: 250,
  qualificationEvent: "FIRST_DELIVERED_ORDER",
  minimumOrderAmount: 999,
  rewardDelayDays: 0,
  maximumSuccessfulReferralsPerUser: null,
  codePrefix: "DAMRU",
  codeLength: 6,
  requireEmailVerified: false,
  requireMobileVerified: false,
  allowExistingUserReferralCodeEntry: false,
  startsAt: null,
  endsAt: null,
};

export async function getReferralConfig(): Promise<ReferralConfigValues> {
  await connectDB();
  const doc = await ReferralConfig.findOne().lean<IReferralConfig>();
  if (!doc) return DEFAULTS;
  return {
    isActive: doc.isActive,
    referrerRewardDamru: doc.referrerRewardDamru,
    referredUserRewardDamru: doc.referredUserRewardDamru,
    qualificationEvent: doc.qualificationEvent,
    minimumOrderAmount: doc.minimumOrderAmount,
    rewardDelayDays: doc.rewardDelayDays,
    maximumSuccessfulReferralsPerUser: doc.maximumSuccessfulReferralsPerUser,
    codePrefix: doc.codePrefix,
    codeLength: doc.codeLength,
    requireEmailVerified: doc.requireEmailVerified,
    requireMobileVerified: doc.requireMobileVerified,
    allowExistingUserReferralCodeEntry: doc.allowExistingUserReferralCodeEntry,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
  };
}

export async function getOrCreateReferralConfig() {
  await connectDB();
  let doc = await ReferralConfig.findOne();
  if (!doc) doc = await ReferralConfig.create({});
  return doc;
}
