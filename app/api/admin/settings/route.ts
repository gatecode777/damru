import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

// GET — load settings (creates default doc if none exists)
export async function GET() {
  const deny = await checkApiPerm("settings", "view");
  if (deny) return deny;
  try {
    await connectDB();
    let settings = await SiteSettings.findOne().lean();
    if (!settings) {
      settings = await SiteSettings.create({});
      settings = await SiteSettings.findOne().lean();
    }
    return NextResponse.json({ settings: JSON.parse(JSON.stringify(settings)) });
  } catch (err) {
    console.error("GET settings error:", err);
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
  }
}

// PATCH — update settings
export async function PATCH(req: NextRequest) {
  const deny = await checkApiPerm("settings", "edit");
  if (deny) return deny;
  try {
    const body = await req.json();
    if (body.deliveryRadiusKm != null && (!Number.isFinite(Number(body.deliveryRadiusKm)) || Number(body.deliveryRadiusKm) < 1 || Number(body.deliveryRadiusKm) > 100)) {
      return NextResponse.json({ error: "Delivery radius must be between 1 and 100 km." }, { status: 400 });
    }
    await connectDB();
    const updated = await SiteSettings.findOneAndUpdate(
      {},
      { $set: body },
      { new: true, upsert: true }
    ).lean();
    return NextResponse.json({ success: true, settings: JSON.parse(JSON.stringify(updated)) });
  } catch (err) {
    console.error("PATCH settings error:", err);
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
  }
}
