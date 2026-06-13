import type { Metadata } from "next";
import { connectDB } from "@/lib/mongodb";
import GalleryTab from "@/models/GalleryTab";
import GalleryClient from "./GalleryClient";

export const metadata: Metadata = {
  title: "Gallery | Damru By Namo",
  description: "View the beautiful gallery of Damru By Namo banquet hall and restaurant in Jaipur.",
  keywords: ["gallery damru", "banquet hall images jaipur", "damru by namo photos", "wedding venue jaipur pictures"],
};

export default async function GalleryPage() {
  await connectDB();
  const tabs = await GalleryTab.find({ isActive: true, tabKey: { $ne: "all" } })
    .sort({ sortOrder: 1 })
    .lean();

  const serializedTabs = JSON.parse(JSON.stringify(tabs));

  return <GalleryClient initialTabs={serializedTabs} />;
}