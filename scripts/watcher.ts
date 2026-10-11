// scripts/watcher.ts
import chokidar from "chokidar";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const home = process.env.HOME || "";
const downloadsDir = path.join(home, "Downloads");
const vaultRoot = path.join(home, "Creative_Vault");
const inboxDir = path.join(vaultRoot, "Inbox");

if (!fs.existsSync(inboxDir)) {
  fs.mkdirSync(inboxDir, { recursive: true });
}

console.log(`\n⚡ Vault Watcher active!`);
console.log(`📥 Watching: ${downloadsDir}`);
console.log(`📦 Ingesting to: ${inboxDir}\n`);

const watcher = chokidar.watch(downloadsDir, {
  depth: 0,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 800,
    pollInterval: 100,
  },
});

watcher.on("add", async (srcPath) => {
  const fileName = path.basename(srcPath);

  const isImage = /\.(jpe?g|png|webp)$/i.test(fileName);
  if (!isImage) return;

  console.log(`🔍 Detected new asset: ${fileName}`);

  const targetFileName = `${Date.now()}_${fileName.replace(/\s+/g, "_")}`;
  const destPath = path.join(inboxDir, targetFileName);

  try {
    const meta = await sharp(srcPath).metadata();

    // Re-encode through sharp (drops C2PA/AI provenance manifests)
    await sharp(srcPath).jpeg({ quality: 95, mozjpeg: true }).toFile(destPath);

    fs.unlinkSync(srcPath);

    const relativePath = path.relative(vaultRoot, destPath);
    const newAsset = await prisma.asset.create({
      data: {
        filePath: relativePath,
        fileName: targetFileName,
        width: meta.width ?? null,
        height: meta.height ?? null,
        aspectRatio:
          meta.width && meta.height ? meta.width / meta.height : null,
      },
    });

    console.log(`✅ Scrubbed & Ingested: ${targetFileName}`);

    // Ping the Next.js dev server live event stream
    try {
      await fetch("http://localhost:3000/api/events/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAsset),
      });
    } catch {
      // Dev server might not be running yet, silent pass
    }
  } catch (err) {
    console.error(`❌ Failed processing ${fileName}:`, err);
  }
});
