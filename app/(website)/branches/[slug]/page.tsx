import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";
import BranchDetailClient from "./BranchDetailClient";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    await connectDB();
    const b = await Branch.findOne({ slug, isActive: true }).select("name description").lean() as any;
    if (!b) return { title: "Branch Not Found" };
    return { title: `${b.name} | Damru By Namo`, description: b.description };
  } catch { return { title: "Branch | Damru By Namo" }; }
}

export async function generateStaticParams() {
  try {
    await connectDB();
    const branches = await Branch.find({ isActive: true }).select("slug").lean();
    return (branches as any[]).map((b: any) => ({ slug: b.slug }));
  } catch { return []; }
}

export default async function BranchDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let b: any = null;
  try {
    await connectDB();
    b = JSON.parse(JSON.stringify(await Branch.findOne({ slug, isActive: true }).lean()));
  } catch { notFound(); }
  if (!b) notFound();

  const hallCards = [...(b.hallCards || [])].sort((a: any, x: any) => a.sortOrder - x.sortOrder);

  return <BranchDetailClient branch={b} hallCards={hallCards} />;
}