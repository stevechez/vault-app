// app/api/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { assetIds, format = "webp" } = await req.json();

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: "No asset IDs provided" },
        { status: 400 },
      );
    }

    const home = process.env.HOME || "";
    const vaultRoot = path.join(home, "Creative_Vault");
    const exportDir = path.join(vaultRoot, "Exports");

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds } },
    });

    const exportedFiles: string[] = [];

    for (const asset of assets) {
      const srcPath = path.join(vaultRoot, asset.filePath);
      if (!fs.existsSync(srcPath)) continue;

      const baseName = path.parse(asset.fileName).name;
      const targetFileName = `${baseName}.${format}`;
      const destPath = path.join(exportDir, targetFileName);

      if (format === "webp") {
        await sharp(srcPath).webp({ quality: 90 }).toFile(destPath);
      } else {
        await sharp(srcPath).jpeg({ quality: 95 }).toFile(destPath);
      }

      exportedFiles.push(destPath);
    }

    return NextResponse.json({
      success: true,
      count: exportedFiles.length,
      destination: exportDir,
    });
  } catch (error) {
    console.error("Export failed:", error);
    return NextResponse.json(
      { error: "Failed to export assets" },
      { status: 500 },
    );
  }
}
