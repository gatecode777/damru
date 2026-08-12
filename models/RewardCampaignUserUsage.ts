import mongoose,{Document,Model,Schema}from"mongoose";
interface IUsage extends Document{campaignId:mongoose.Types.ObjectId;userId:mongoose.Types.ObjectId;issuedDamru:number}
const schema=new Schema<IUsage>({campaignId:{type:Schema.Types.ObjectId,ref:"RewardCampaign",required:true},userId:{type:Schema.Types.ObjectId,ref:"User",required:true},issuedDamru:{type:Number,default:0,min:0}},{timestamps:true});schema.index({campaignId:1,userId:1},{unique:true});
const Model_:Model<IUsage>=mongoose.models.RewardCampaignUserUsage||mongoose.model<IUsage>("RewardCampaignUserUsage",schema);export default Model_;
