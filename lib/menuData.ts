import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/mongodb";
import CategoryModel from "@/models/Category";
import MenuItemModel from "@/models/MenuItem";

export type PublicMenuData = {
  categories: Array<{ _id: string; name: string; slug: string; description: string; sortOrder: number }>;
  items: Array<{
    _id: string; name: string; description: string; image?: string; basePrice: number;
    price: number; variantType: string; variants: { label: string; price: number }[];
    hasVariants: boolean; isVeg: boolean; category: string; sortOrder: number;
  }>;
};

async function queryPublicMenu(): Promise<PublicMenuData> {
  await connectDB();
  const [categories, items] = await Promise.all([
    CategoryModel.find({ isActive: true }).select("name slug description sortOrder").sort({ sortOrder: 1 }).lean(),
    MenuItemModel.find({ isActive: true })
      .select("name description image basePrice variantType variants category isVeg sortOrder")
      .sort({ sortOrder: 1 }).lean(),
  ]);

  return {
    categories: categories.map((category: any) => ({
      _id: String(category._id), name: category.name, slug: category.slug || "",
      description: category.description || "", sortOrder: category.sortOrder || 0,
    })),
    items: items.map((item: any) => {
      const variants = item.variants || [];
      const variantPrices = variants.map((variant: any) => Number(variant.price) || 0).filter((price: number) => price > 0);
      const basePrice = Number(item.basePrice) || 0;
      return {
        _id: String(item._id), name: item.name, description: item.description || "", image: item.image || "",
        basePrice, price: basePrice || (variantPrices.length ? Math.min(...variantPrices) : 0),
        variantType: item.variantType || "none", variants, hasVariants: variants.length > 0,
        isVeg: item.isVeg !== false, category: String(item.category), sortOrder: item.sortOrder || 0,
      };
    }),
  };
}

export const getPublicMenu = unstable_cache(queryPublicMenu, ["public-menu-v1"], {
  tags: ["public-menu"],
  revalidate: 300,
});
