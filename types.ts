/**
 * cache-meter/types.ts — structural shapes for the prefix-churn measurement.
 *
 * The recorder reads the per-turn token `usage` that pi attaches to assistant
 * messages on `message_end` (verified against pi v0.79.0; same fields the
 * subagent extension accumulates). `usage.input` is FRESH input only —
 * `max(0, promptTokens − cacheRead − cacheWrite)` — so the cache-hit ratio is
 * `cacheRead / (cacheRead + input)`. See ADR-0034 and issue #338.
 */

/** The per-turn token usage pi exposes on an assistant message. */
export interface MessageUsage {
  /** Fresh (uncached) input tokens. */
  readonly input?: number;
  readonly output?: number;
  /** Tokens served from the provider prompt cache. */
  readonly cacheRead?: number;
  /** Tokens written to the provider prompt cache (one-time warm cost). */
  readonly cacheWrite?: number;
  readonly totalTokens?: number;
  /** Realized dollar cost for this message; `total` is the sum. */
  readonly cost?: { readonly total?: number };
}

/** The slice of an assistant message the recorder reads. */
export interface AssistantMessageLike {
  readonly role: string;
  readonly model?: string;
  /** Message-level provider (read atomically with `model`, not from ctx). */
  readonly provider?: string;
  readonly usage?: MessageUsage;
}

/** One JSONL record appended per assistant turn. */
export interface TurnRecord {
  /** ISO-8601 UTC timestamp. */
  readonly ts: string;
  /** 1-based assistant-turn index within the session. */
  readonly turn: number;
  readonly model: string;
  readonly provider: string;
  /** Fresh input tokens (`usage.input`). */
  readonly input: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly output: number;
  /** Realized cost for the turn, or null when the provider omits it. */
  readonly costTotal: number | null;
  /** The measurement config slot (CACHE_METER_CONFIG), e.g. "baseline". */
  readonly config: string;
}
