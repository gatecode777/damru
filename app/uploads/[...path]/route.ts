import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/zp0tch54w";

  // Reconstruct the file path (e.g., blogs/image-name.jpg)
  const filePath = pathSegments.join("/");
  const imageKitUrl = `${urlEndpoint}/uploads/${filePath}`;

  try {
    const res = await fetch(imageKitUrl);
    if (!res.ok) {
      console.warn(`[Image Proxy] Image not found on ImageKit: ${imageKitUrl}`);
      return new NextResponse("Not Found", { status: 404 });
    }

    // Pipe the stream directly back to the client
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("Error proxying image from ImageKit:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
