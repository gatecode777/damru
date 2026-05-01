import mongoose, { Schema, Document, Model } from "mongoose";

export type OrderStatus = "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
export type PaymentMethod = "cod" | "upi" | "card";
export type PaymentStatus = "pending" | "paid" | "failed";

export interface IOrderItem {
  menuItemId?: mongoose.Types.ObjectId;
  name:        string;
  image?:      string;
  variantType: string;
  custom:      string;
  price:       number;
  qty:         number;
}

export interface IDeliveryAddress {
  label:    string;
  fullName: string;
  phone:    string;
  house:    string;
  area:     string;
  city:     string;
  state:    string;
  pincode:  string;
}

export interface IOrder extends Document {
  orderId:         string;           // human-readable: DMR-20260427-XXXX
  userId:          mongoose.Types.ObjectId;
  userName:        string;
  userEmail:       string;
  userPhone:       string;
  items:           IOrderItem[];
  deliveryAddress: IDeliveryAddress;
  subtotal:        number;
  discount:        number;
  couponCode:      string;
  tax:             number;
  shipping:        number;
  total:           number;
  paymentMethod:   PaymentMethod;
  paymentStatus:   PaymentStatus;
  status:          OrderStatus;
  notes:           string;
  createdAt:       Date;
  updatedAt:       Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    menuItemId:  { type: Schema.Types.ObjectId, ref: "MenuItem" },
    name:        { type: String, required: true },
    image:       { type: String },
    variantType: { type: String, default: "none" },
    custom:      { type: String, default: "" },
    price:       { type: Number, required: true },
    qty:         { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const DeliveryAddressSchema = new Schema<IDeliveryAddress>(
  {
    label:    { type: String, default: "Home" },
    fullName: { type: String, required: true },
    phone:    { type: String, required: true },
    house:    { type: String, required: true },
    area:     { type: String, default: "" },
    city:     { type: String, required: true },
    state:    { type: String, required: true },
    pincode:  { type: String, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderId:         { type: String, required: true, unique: true },
    userId:          { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName:        { type: String, required: true },
    userEmail:       { type: String, required: true },
    userPhone:       { type: String, default: "" },
    items:           { type: [OrderItemSchema], required: true },
    deliveryAddress: { type: DeliveryAddressSchema, required: true },
    subtotal:        { type: Number, required: true },
    discount:        { type: Number, default: 0 },
    couponCode:      { type: String, default: "" },
    tax:             { type: Number, default: 0 },
    shipping:        { type: Number, default: 0 },
    total:           { type: Number, required: true },
    paymentMethod:   { type: String, enum: ["cod", "upi", "card"], default: "cod" },
    paymentStatus:   { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    status:          { type: String, enum: ["pending","confirmed","preparing","out_for_delivery","delivered","cancelled"], default: "pending" },
    notes:           { type: String, default: "" },
  },
  { timestamps: true }
);

OrderSchema.index({ userId: 1 });
OrderSchema.index({ orderId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

// Force delete any cached (stale) model to ensure new schema is always used
if (mongoose.models.Order) { delete (mongoose.models as Record<string, unknown>).Order; }
const Order: Model<IOrder> = mongoose.model<IOrder>("Order", OrderSchema);

export default Order;