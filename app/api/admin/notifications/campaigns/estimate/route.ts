import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { estimateAudienceSize } from "@/lib/notifications/campaignService";

/** Live audience-size preview for the composer UI — before the campaign is created (section 57). */
export async function POST(req: NextRequest) {
  const deny = await checkApiPerm("notifications", "view");
  if (deny) return deny;

  try {
    const { audience } = await req.json();
    if (!audience?.segment) return NextResponse.json({ error: "audience.segment is required." }, { status: 400 });

    const count = await estimateAudienceSize(audience);
    return NextResponse.json({ estimatedRecipients: count });
  } catch (err) {
    console.error("POST admin/notifications/campaigns/estimate error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
