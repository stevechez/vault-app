// app/api/events/ping/route.ts
import { NextRequest, NextResponse } from "next/server";
import { vaultEvents } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const asset = await req.json();
    vaultEvents.emit("new-asset", asset);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to emit event" },
      { status: 400 },
    );
  }
}
