import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICartItem {
  menuItemId:  mongoose.Types.ObjectId;
  name:        string;
  image?:      string;
  variantType: string;
  custom:      string;    // e.g. "Half", "250gm", "Coke, French Fries"
  price:       number;    // price per unit (with variant applied)
  qty:         number;
}

export interface ICart extends Document {
  userId:    mongoose.Types.ObjectId;
  items:     ICartItem[];
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    menuItemId:  { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    name:        { type: String, required: true },
    image:       { type: String },
    variantType: { type: String, default: "none" },
    custom:      { type: String, default: "" },
    price:       { type: Number, required: true, min: 0 },
    qty:         { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

const CartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items:  { type: [CartItemSchema], default: [] },
  },
  { timestamps: true }
);

const Cart: Model<ICart> =
  mongoose.models.Cart || mongoose.model<ICart>("Cart", CartSchema);

export default Cart;