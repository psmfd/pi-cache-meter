/**
 * cache-meter — read-only prefix-churn / cache-ratio recorder (issue #338).
 *
 * When CACHE_METER_CONFIG is set, records per-assistant-turn token usage
 * (`input`, `cacheRead`, `cacheWrite`, `output`, `cost.total`) to a JSONL log
 * tagged with that config slot, for offline analysis by
 * scripts/analyze-cache-ratio.sh. Inert unless CACHE_METER_CONFIG is set, so it
 * adds nothing to normal sessions.
 *
 * Invariant: the `message_end` handler is OBSERVATIONAL — it returns undefined
 * and never a replacement `{ message }`. A measurement tool that rewrote the
 * message would itself churn the cached prefix it is meant to measure. See
 * ADR-0034.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { buildRecord } from "./record.ts";
import { appendTurn } from "./state.ts";
import type { AssistantMessageLike } from "./types.ts";

interface MessageEndEvent {
  message?: AssistantMessageLike;
}

interface ModelContext {
  model?: { provider?: string };
}

function resolveProvider(ctx: ExtensionContext): string {
  return (ctx as unknown as ModelContext).model?.provider ?? "unknown";
}

export default function cacheMeter(pi: ExtensionAPI): void {
  const config = process.env.CACHE_METER_CONFIG?.trim();
  // Inert unless a measurement config is named — no recording in normal use.
  if (!config) return;

  let turn = 0;

  pi.on("session_start", (_event, ctx) => {
    turn = 0;
    if (ctx.hasUI) ctx.ui.setStatus("cache-meter", `📊 metering ${config}`);
  });

  pi.on("message_end", async (event, ctx) => {
    // Observational only — never return a replacement message (no prefix churn).
    try {
      const message = (event as unknown as MessageEndEvent).message;
      if (!message || message.role !== "assistant") return undefined;
      turn += 1;
      const record = buildRecord(message, {
        ts: new Date().toISOString(),
        turn,
        // Fallback only — buildRecord prefers the message's own provider so a
        // mid-session model switch is attributed to the turn that produced it.
        providerFallback: resolveProvider(ctx),
        config,
      });
      if (record) await appendTurn(record);
    } catch {
      // Measurement must never disturb a turn.
    }
    return undefined;
  });
}
