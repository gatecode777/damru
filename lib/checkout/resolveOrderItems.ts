import mongoose from "mongoose";
import MenuItem from "@/models/MenuItem";

interface RawOrderItem {
  menuItemId?: string | mongoose.Types.ObjectId;
  custom?: string;
  qty?: number;
}

export interface ResolvedOrderItem {
  menuItemId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  name: string;
  image?: string;
  variantType: string;
  custom: string;
  price: number;
  qty: number;
}

export async function resolveOrderItems(rawItems: RawOrderItem[]): Promise<ResolvedOrderItem[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error("Your cart is empty.");
  const ids = [...new Set(rawItems.map(item => String(item.menuItemId || "")))];
  if (ids.some(id => !mongoose.isValidObjectId(id))) throw new Error("Your cart contains an invalid item.");
  const menuItems = await MenuItem.find({ _id: { $in: ids }, isActive: true }).lean();
  const byId = new Map(menuItems.map(item => [String(item._id), item]));

  return rawItems.map(raw => {
    const item = byId.get(String(raw.menuItemId));
    if (!item) throw new Error("An item in your cart is no longer available.");
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error("Item quantity must be between 1 and 99.");
    const custom = String(raw.custom || "").trim();
    let price = item.basePrice;
    if (item.variantType === "addon") {
      const labels = custom ? custom.split(",").map(label => label.trim()).filter(Boolean) : [];
      const unique = new Set(labels);
      if (unique.size !== labels.length) throw new Error(`Invalid customisation for ${item.name}.`);
      for (const label of labels) {
        const variant = item.variants.find(option => option.label === label);
        if (!variant) throw new Error(`Invalid customisation for ${item.name}.`);
        price += variant.price;
      }
    } else if (item.variantType !== "none") {
      const variant = item.variants.find(option => option.label === custom);
      if (!variant) throw new Error(`Select a valid option for ${item.name}.`);
      price = variant.price;
    }
    return {
      menuItemId: item._id,
      categoryId: item.category,
      name: item.name,
      image: item.image,
      variantType: item.variantType,
      custom,
      price,
      qty,
    };
  });
}
