// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { vaultEvents } from "@/lib/events";
import { uploadToR2 } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const createdAssets = [];

    for (const file of files) {
      const originalBuffer = Buffer.from(await file.arrayBuffer());
      const safeBaseName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/\s+/g, "_");
      const safeName = `${Date.now()}_${safeBaseName}.jpg`;
      const r2Key = `inbox/${safeName}`;

      // 1. Read metadata
      const meta = await sharp(originalBuffer).metadata();

      // 2. Re-encode through sharp (strips AI/C2PA manifests, outputs buffer instead of disk file)
      const processedBuffer = await sharp(originalBuffer)
        .jpeg({ quality: 95, mozjpeg: true })
        .toBuffer();

      // 3. Upload directly to Cloudflare R2
      const publicUrl = await uploadToR2(processedBuffer, r2Key, "image/jpeg");

      // 4. Save to SQLite via Prisma (storing the public R2 URL in filePath)
      const asset = await prisma.asset.create({
        data: {
          filePath: publicUrl,
          fileName: safeName,
          width: meta.width ?? null,
          height: meta.height ?? null,
          aspectRatio:
            meta.width && meta.height ? meta.width / meta.height : null,
        },
      });

      // 5. Emit SSE event so the browser grid updates in real time
      vaultEvents.emit("new-asset", asset);

      createdAssets.push(asset);
    }

    return NextResponse.json({ success: true, assets: createdAssets });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "Failed to process files" },
      { status: 500 },
    );
  }
}
