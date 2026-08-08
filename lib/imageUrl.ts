/**
 * Uploaded files are stored on ImageKit and normally served through the app's own
 * `/uploads/[...path]` route, which proxies each request through this Next.js server
 * to ImageKit. For `next/image` usages, that adds a needless extra server hop — Next's
 * image optimizer can fetch directly from ImageKit's CDN instead, since `ik.imagekit.io`
 * is already an allowed remote pattern. Use this helper wherever an uploaded file is
 * rendered via `next/image`; keep the `/uploads/...` path for plain `<img>`/CSS usages.
 */
const IMAGEKIT_URL_ENDPOINT =
  process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/zp0tch54w";

export function uploadedImageUrl(folder: string, filename: string): string {
  return `${IMAGEKIT_URL_ENDPOINT}/DAMRU/${folder}/${filename}`;
}
