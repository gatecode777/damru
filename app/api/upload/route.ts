import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { getUserFromCookie } from "@/lib/userSession";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED  = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Valid upload targets → maps to subdirectory under /public/uploads/
const TARGETS: Record<string, string> = {
  avatar:    "avatars",
  menuitem:  "menu-items",
  blog:      "blogs",
  author:    "authors",
  gallery:   "gallery",
  branch:    "branches",
};

export async function POST(req: NextRequest) {
  const adminSession = await auth();
  const userSession  = getUserFromCookie(req);
  if (!adminSession && !userSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file     = formData.get("file")   as File | null;
  const target   = (formData.get("target") as string) || "avatar";

  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED.includes(file.type))
    return NextResponse.json({ error: "Only JPG, PNG, WEBP files allowed" }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "File too large. Maximum 3 MB." }, { status: 400 });

  const subDir = TARGETS[target] ?? "misc";
  const uploadDir = path.join(process.cwd(), "public", "uploads", subDir);

  // Sanitised unique filename
  const ext      = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const base     = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  const filename = `${base}-${Date.now()}.${ext}`;

  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  return NextResponse.json({
    filename,
    url: `/uploads/${subDir}/${filename}`,
  });
}