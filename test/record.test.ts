import assert from "node:assert/strict";
import { test } from "node:test";

import { buildRecord, toJsonl } from "../record.ts";
import type { AssistantMessageLike } from "../types.ts";

const CTX = { ts: "2026-06-11T00:00:00.000Z", turn: 3, providerFallback: "anthropic", config: "baseline" };

test("buildRecord returns null for non-assistant messages", () => {
  assert.equal(buildRecord({ role: "user" }, CTX), null);
  assert.equal(buildRecord({ role: "toolResult" }, CTX), null);
  assert.equal(buildRecord(undefined, CTX), null);
});

test("buildRecord extracts usage fields from an assistant message", () => {
  const msg: AssistantMessageLike = {
    role: "assistant",
    model: "claude-opus-4-8",
    usage: { input: 1200, output: 300, cacheRead: 8000, cacheWrite: 0, cost: { total: 0.0142 } },
  };
  assert.deepEqual(buildRecord(msg, CTX), {
    ts: CTX.ts,
    turn: 3,
    model: "claude-opus-4-8",
    provider: "anthropic",
    input: 1200,
    cacheRead: 8000,
    cacheWrite: 0,
    output: 300,
    costTotal: 0.0142,
    config: "baseline",
  });
});

test("buildRecord defaults missing usage fields to 0 and cost to null", () => {
  const rec = buildRecord({ role: "assistant", usage: {} }, CTX);
  assert.equal(rec?.input, 0);
  assert.equal(rec?.cacheRead, 0);
  assert.equal(rec?.cacheWrite, 0);
  assert.equal(rec?.output, 0);
  assert.equal(rec?.costTotal, null);
  assert.equal(rec?.model, "unknown");
});

test("buildRecord coerces non-finite usage values to 0", () => {
  const rec = buildRecord(
    { role: "assistant", usage: { input: Number.NaN, cacheRead: Infinity } as never },
    CTX,
  );
  assert.equal(rec?.input, 0);
  assert.equal(rec?.cacheRead, 0);
});

test("buildRecord treats a provider that omits cache fields as zero (not an error)", () => {
  // github-copilot path (#1073): cacheRead/cacheWrite absent.
  const rec = buildRecord({ role: "assistant", usage: { input: 5000 } }, { ...CTX, providerFallback: "github-copilot" });
  assert.equal(rec?.cacheRead, 0);
  assert.equal(rec?.cacheWrite, 0);
  assert.equal(rec?.input, 5000);
});

test("buildRecord reads provider from the message atomically, not from ctx (#809)", () => {
  // A turn produced by a different provider than the session's current model
  // (e.g. an auto-router mid-session switch) must record its OWN provider —
  // never the ctx fallback — so per-provider cache diagnosis stays correct.
  const msg: AssistantMessageLike = { role: "assistant", model: "gpt-5-mini", provider: "openai", usage: { input: 100 } };
  const rec = buildRecord(msg, { ...CTX, providerFallback: "anthropic" });
  assert.equal(rec?.provider, "openai"); // message provider wins over the ctx fallback
  assert.equal(rec?.model, "gpt-5-mini");
  // Fallback path: a message with no provider falls back to ctx.
  const noProv = buildRecord({ role: "assistant", model: "m", usage: { input: 1 } }, { ...CTX, providerFallback: "anthropic" });
  assert.equal(noProv?.provider, "anthropic");
});

test("toJsonl emits a single line with a trailing newline", () => {
  const line = toJsonl(buildRecord({ role: "assistant", usage: { input: 1 } }, CTX)!);
  assert.ok(line.endsWith("\n"));
  assert.equal(line.split("\n").length, 2);
  const parsed = JSON.parse(line) as { config: string };
  assert.equal(parsed.config, "baseline");
});
