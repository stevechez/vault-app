// app/api/reveal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { exec } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export async function POST(req: NextRequest) {
  try {
    const { filePath } = await req.json();
    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }

    const vaultRoot = path.join(process.env.HOME || "", "Creative_Vault");
    const fullPath = path.join(vaultRoot, filePath);

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: "File does not exist" },
        { status: 404 },
      );
    }

    // macOS native reveal in Finder
    exec(`open -R "${fullPath}"`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Finder reveal error:", error);
    return NextResponse.json(
      { error: "Failed to reveal file" },
      { status: 500 },
    );
  }
}
