// app/api/media/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const decodedPath = decodeURIComponent(segments.join("/"));

  const vaultRoot = path.join(process.env.HOME || "", "Creative_Vault");
  const fullPath = path.join(vaultRoot, decodedPath);

  if (!fs.existsSync(fullPath)) {
    return new NextResponse("Asset not found", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const stat = fs.statSync(fullPath);
  const stream = fs.createReadStream(fullPath);

  const ext = path.extname(fullPath).toLowerCase();
  const contentType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".mp4"
          ? "video/mp4"
          : "image/jpeg";

  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": stat.size.toString(),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
