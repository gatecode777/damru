import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import RewardCampaign,{IRewardCampaign}from"@/models/RewardCampaign";
import RewardCampaignUsage from "@/models/RewardCampaignUsage";
import RewardCampaignUserUsage from "@/models/RewardCampaignUserUsage";
import User from "@/models/User";
import Order from "@/models/Order";
import { awardDamru } from "@/lib/rewardEngine";
import { calculateCampaignBonus, selectCampaignBonuses } from "@/lib/rewards/campaignMath";
import { paymentEligibleOrderFilter } from "@/lib/orders/orderPaymentPolicy";
export { calculateCampaignBonus, selectCampaignBonuses } from "@/lib/rewards/campaignMath";

export type CampaignEventContext={trigger:IRewardCampaign["trigger"];userId:string|mongoose.Types.ObjectId;sourceId:string;baseReward:number;orderId?:string|mongoose.Types.ObjectId;eligibleAmount?:number;branchId?:string|mongoose.Types.ObjectId|null;categoryIds?:Array<string|mongoose.Types.ObjectId>;menuItemIds?:Array<string|mongoose.Types.ObjectId>;missionId?:string|mongoose.Types.ObjectId;now?:Date};
const ids=(values:Array<string|mongoose.Types.ObjectId>|undefined)=>new Set((values||[]).map(String));
const intersects=(configured:mongoose.Types.ObjectId[],actual:Set<string>)=>configured.length===0||configured.some(id=>actual.has(String(id)));
export async function findActiveCampaigns(trigger:IRewardCampaign["trigger"],now=new Date()){await connectDB();return RewardCampaign.find({status:{$in:["ACTIVE","SCHEDULED"]},trigger,startsAt:{$lte:now},endsAt:{$gt:now}}).sort({priority:-1,code:1})}
export async function checkCampaignEligibility(c:IRewardCampaign,ctx:CampaignEventContext,user:{createdAt:Date;loyaltyTierId?:mongoose.Types.ObjectId;damruTotalEarned?:number}){
 const now=ctx.now||new Date();if(!["ACTIVE","SCHEDULED"].includes(c.status)||c.startsAt>now||c.endsAt<=now)return false;
 if(c.audience==="NEW_USERS"&&(now.getTime()-new Date(user.createdAt).getTime())/86400000>c.newUserMaxAgeDays)return false;
 if(c.audience==="SELECTED_USERS"&&!c.selectedUsers.some(id=>String(id)===String(ctx.userId)))return false;
 if(c.audience==="LOYALTY_TIER"&&(!user.loyaltyTierId||!c.eligibleLoyaltyTiers.some(id=>String(id)===String(user.loyaltyTierId))))return false;
 if(c.audience==="REPEAT_CUSTOMERS"&&await Order.countDocuments({userId:ctx.userId,status:"delivered",...paymentEligibleOrderFilter()})<2)return false;
 if(c.minimumOrderAmount>0&&(ctx.eligibleAmount||0)<c.minimumOrderAmount)return false;
 if(c.eligibleBranches.length&&(!ctx.branchId||!c.eligibleBranches.some(id=>String(id)===String(ctx.branchId))))return false;
 if(!intersects(c.eligibleCategories,ids(ctx.categoryIds))||!intersects(c.eligibleMenuItems,ids(ctx.menuItemIds)))return false;
 if(c.missionIds.length&&(!ctx.missionId||!c.missionIds.some(id=>String(id)===String(ctx.missionId))))return false;
 return true;
}
async function reserve(c:IRewardCampaign,userId:CampaignEventContext["userId"],sourceId:string,amount:number,snapshot:Record<string,unknown>){
 try{await RewardCampaignUsage.create({campaignId:c._id,userId,sourceId,rewardAmount:amount,status:"RESERVED",snapshot})}catch(e){if(!(typeof e==="object"&&e&&"code"in e&&(e as{code:number}).code===11000))throw e;
 // A previous attempt for this exact event was RELEASED (its award failed and budgets were rolled back) — reclaim it so a retry can still award exactly once.
 const reclaimed=await RewardCampaignUsage.findOneAndUpdate({campaignId:c._id,userId,sourceId,status:"RELEASED"},{$set:{status:"RESERVED",rewardAmount:amount,snapshot}});if(!reclaimed)return null}
 const global=await RewardCampaign.findOneAndUpdate({_id:c._id,status:{$in:["ACTIVE","SCHEDULED"]},startsAt:{$lte:new Date()},endsAt:{$gt:new Date()},$expr:{$or:[{$eq:["$globalBudgetDamru",null]},{$lte:[{$add:["$issuedDamru",amount]},"$globalBudgetDamru"]}]}},{$inc:{issuedDamru:amount,qualifyingEvents:1}},{new:true});
 if(!global){await RewardCampaignUsage.deleteOne({campaignId:c._id,userId,sourceId,status:"RESERVED"});return null}
 await RewardCampaignUserUsage.updateOne({campaignId:c._id,userId},{$setOnInsert:{issuedDamru:0}},{upsert:true}).catch(()=>undefined);
 const perUser=await RewardCampaignUserUsage.findOneAndUpdate({campaignId:c._id,userId,$expr:{$or:[{$eq:[c.maxRewardPerUser,null]},{$lte:[{$add:["$issuedDamru",amount]},c.maxRewardPerUser]}]}},{$inc:{issuedDamru:amount}},{new:true});
 if(!perUser){await RewardCampaign.updateOne({_id:c._id},{$inc:{issuedDamru:-amount,qualifyingEvents:-1}});await RewardCampaignUsage.deleteOne({campaignId:c._id,userId,sourceId,status:"RESERVED"});return null}
 return global;
}
export async function awardCampaignBonuses(ctx:CampaignEventContext){await connectDB();if(ctx.trigger==="ORDER_DELIVERED"&&(!ctx.orderId||!await Order.exists({_id:ctx.orderId,userId:ctx.userId,status:"delivered",...paymentEligibleOrderFilter()})))return[];const user=await User.findById(ctx.userId).select("createdAt loyaltyTierId damruTotalEarned").lean();if(!user)return[];const campaigns=await findActiveCampaigns(ctx.trigger,ctx.now);const eligible=[] as Array<{campaign:IRewardCampaign;bonus:number;priority:number;code:string;stackingPolicy:IRewardCampaign["stackingPolicy"]}>;for(const campaign of campaigns){if(await checkCampaignEligibility(campaign,ctx,user as never)){const bonus=calculateCampaignBonus(campaign.rewardMode,campaign.rewardValue,ctx.baseReward,campaign.maxRewardPerEvent);if(bonus>0)eligible.push({campaign,bonus,priority:campaign.priority,code:campaign.code,stackingPolicy:campaign.stackingPolicy})}}
 const selected=selectCampaignBonuses(eligible),results=[];for(const row of selected){const snapshot={campaignCode:row.code,rewardMode:row.campaign.rewardMode,rewardValue:row.campaign.rewardValue,baseReward:ctx.baseReward,bonus:row.bonus,trigger:ctx.trigger,sourceId:ctx.sourceId,minimumOrderAmount:row.campaign.minimumOrderAmount};const reserved=await reserve(row.campaign,ctx.userId,ctx.sourceId,row.bonus,snapshot);if(!reserved)continue;try{const award=await awardDamru({userId:ctx.userId,category:"campaign",amount:row.bonus,description:`Campaign bonus: ${row.campaign.name}`,idempotencyKey:`campaign:${row.campaign._id}:${ctx.userId}:${ctx.sourceId}`,orderId:ctx.orderId,campaignId:row.campaign._id,campaignCode:row.code,campaignSnapshot:snapshot});await RewardCampaignUsage.updateOne({campaignId:row.campaign._id,userId:ctx.userId,sourceId:ctx.sourceId},{$set:{status:"AWARDED"}});if(!award.duplicate){const first=await RewardCampaignUserUsage.findOne({campaignId:row.campaign._id,userId:ctx.userId,issuedDamru:row.bonus}).lean();if(first)await RewardCampaign.updateOne({_id:row.campaign._id},{$inc:{rewardedUsers:1}})}results.push({campaignId:row.campaign._id,amount:row.bonus,...award})}catch(error){await Promise.all([RewardCampaign.updateOne({_id:row.campaign._id},{$inc:{issuedDamru:-row.bonus,qualifyingEvents:-1}}),RewardCampaignUserUsage.updateOne({campaignId:row.campaign._id,userId:ctx.userId},{$inc:{issuedDamru:-row.bonus}}),RewardCampaignUsage.updateOne({campaignId:row.campaign._id,userId:ctx.userId,sourceId:ctx.sourceId},{$set:{status:"RELEASED"}})]);throw error}}
 return results}

/**
 * Read-only preview of the campaign bonuses an order would receive if it were
 * delivered now — used by the checkout/cart Damru estimate. Uses exactly the
 * same eligibility, bonus maths and stacking selection as awardCampaignBonuses,
 * but reserves nothing and writes nothing. Budget/user caps can still change
 * before delivery, so callers must label the result as an estimate.
 */
export async function estimateCampaignBonuses(ctx: CampaignEventContext): Promise<Array<{ campaignId: string; code: string; name: string; amount: number }>> {
  await connectDB();
  const user = await User.findById(ctx.userId).select("createdAt loyaltyTierId damruTotalEarned").lean();
  if (!user) return [];
  const campaigns = await findActiveCampaigns(ctx.trigger, ctx.now);
  const eligible: Array<{ campaign: IRewardCampaign; bonus: number; priority: number; code: string; stackingPolicy: IRewardCampaign["stackingPolicy"] }> = [];
  for (const campaign of campaigns) {
    if (!(await checkCampaignEligibility(campaign, ctx, user as never))) continue;
    const bonus = calculateCampaignBonus(campaign.rewardMode, campaign.rewardValue, ctx.baseReward, campaign.maxRewardPerEvent);
    if (bonus <= 0) continue;
    if (campaign.globalBudgetDamru !== null && campaign.issuedDamru + bonus > campaign.globalBudgetDamru) continue;
    eligible.push({ campaign, bonus, priority: campaign.priority, code: campaign.code, stackingPolicy: campaign.stackingPolicy });
  }
  return selectCampaignBonuses(eligible).map(row => ({ campaignId: String(row.campaign._id), code: row.code, name: row.campaign.name, amount: row.bonus }));
}
