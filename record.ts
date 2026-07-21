/**
 * cache-meter/record.ts — pure turn-record construction (no I/O, no clock).
 *
 * Kept side-effect-free so the recording logic unit-tests without a live pi
 * runtime: the timestamp and turn index are passed in by the caller. Returns
 * null for any non-assistant message (only assistant turns carry usage).
 */

import type { AssistantMessageLike, TurnRecord } from "./types.ts";

export interface RecordContext {
  readonly ts: string;
  readonly turn: number;
  /** Provider fallback when the message omits its own `provider`. */
  readonly providerFallback: string;
  readonly config: string;
}

/** Build a {@link TurnRecord} from an assistant message, or null if not applicable. */
export function buildRecord(message: AssistantMessageLike | undefined, ctx: RecordContext): TurnRecord | null {
  if (!message || message.role !== "assistant") return null;
  const usage = message.usage ?? {};
  return {
    ts: ctx.ts,
    turn: ctx.turn,
    model: message.model ?? "unknown",
    // Read provider from the message so model+provider are atomic — a mid-session
    // model switch (e.g. auto-router) must not attribute this turn's usage to the
    // session's *current* provider. Fall back to ctx only when the message omits it.
    provider: message.provider ?? ctx.providerFallback,
    input: numberOr(usage.input, 0),
    cacheRead: numberOr(usage.cacheRead, 0),
    cacheWrite: numberOr(usage.cacheWrite, 0),
    output: numberOr(usage.output, 0),
    costTotal: typeof usage.cost?.total === "number" ? usage.cost.total : null,
    config: ctx.config,
  };
}

/** Serialize a record as one JSONL line (trailing newline included). */
export function toJsonl(record: TurnRecord): string {
  return `${JSON.stringify(record)}\n`;
}

function numberOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
