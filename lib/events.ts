// lib/events.ts
import { EventEmitter } from "node:events";

const globalForEvents = globalThis as unknown as {
  vaultEventEmitter: EventEmitter | undefined;
};

export const vaultEvents =
  globalForEvents.vaultEventEmitter ?? new EventEmitter();

// Allow multiple clients if needed
vaultEvents.setMaxListeners(20);

if (process.env.NODE_ENV !== "production") {
  globalForEvents.vaultEventEmitter = vaultEvents;
}
