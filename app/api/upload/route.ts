// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { vaultEvents } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const vaultRoot = path.join(process.env.HOME || "", "Creative_Vault");
    const inboxDir = path.join(vaultRoot, "Inbox");

    if (!fs.existsSync(inboxDir)) {
      fs.mkdirSync(inboxDir, { recursive: true });
    }

    const createdAssets = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const destPath = path.join(inboxDir, safeName);

      // 1. Read metadata
      const meta = await sharp(buffer).metadata();

      // 2. Re-encode through sharp (strips AI/C2PA manifests)
      await sharp(buffer).jpeg({ quality: 95, mozjpeg: true }).toFile(destPath);

      // 3. Save to SQLite
      const relativePath = path.relative(vaultRoot, destPath);
      const asset = await prisma.asset.create({
        data: {
          filePath: relativePath,
          fileName: safeName,
          width: meta.width ?? null,
          height: meta.height ?? null,
          aspectRatio:
            meta.width && meta.height ? meta.width / meta.height : null,
        },
      });

      // 4. Emit the SSE event so the browser grid updates instantly
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
