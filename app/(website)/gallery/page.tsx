import type { Metadata } from "next";
import "@/styles/website/gallery.css";
import { connectDB } from "@/lib/mongodb";
import GalleryTab from "@/models/GalleryTab";
import GalleryClient from "./GalleryClient";
import { unstable_cache } from "next/cache";

export const metadata: Metadata = {
  title: "Gallery | Damru By Namo",
  description: "View the beautiful gallery of Damru By Namo banquet hall and restaurant in Jaipur.",
  keywords: ["gallery damru", "banquet hall images jaipur", "damru by namo photos", "wedding venue jaipur pictures"],
};

const getGalleryTabs = unstable_cache(async () => {
  await connectDB();
  const tabs = await GalleryTab.find({ isActive: true, tabKey: { $ne: "all" } })
    .select("tabKey label bannerImage bannerAlt sortOrder items")
    .sort({ sortOrder: 1 }).lean();
  return JSON.parse(JSON.stringify(tabs));
}, ["website-gallery-tabs"], { revalidate: 300, tags: ["public-content"] });

export default async function GalleryPage() {
  const serializedTabs = await getGalleryTabs();

  return <GalleryClient initialTabs={serializedTabs} />;
}
