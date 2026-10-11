// app/api/events/route.ts
import { NextResponse } from "next/server";
import { vaultEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const onNewAsset = (asset: unknown) => {
        const payload = `data: ${JSON.stringify(asset)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      vaultEvents.on("new-asset", onNewAsset);

      // Keep-alive heartbeat every 20s
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 20000);

      return () => {
        vaultEvents.off("new-asset", onNewAsset);
        clearInterval(heartbeat);
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
