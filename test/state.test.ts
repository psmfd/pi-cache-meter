import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { appendTurn, logPath } from "../state.ts";
import type { TurnRecord } from "../types.ts";

async function tmpAgentDir(): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), "pi-suite-cache-meter-"));
}

function rec(turn: number, over: Partial<TurnRecord> = {}): TurnRecord {
  return {
    ts: "2026-06-11T00:00:00.000Z",
    turn,
    model: "claude-opus-4-8",
    provider: "anthropic",
    input: 100,
    cacheRead: 900,
    cacheWrite: 0,
    output: 50,
    costTotal: 0.001,
    config: "baseline",
    ...over,
  };
}

test("logPath resolves under the cache-meter namespace", () => {
  assert.ok(logPath("/tmp/x").endsWith("/extensions/cache-meter/turns.jsonl"));
});

test("appendTurn creates the dir and appends one JSONL line per record", async () => {
  const dir = await tmpAgentDir();
  await appendTurn(rec(1), dir);
  await appendTurn(rec(2, { config: "indexing" }), dir);
  const body = await fs.readFile(logPath(dir), "utf8");
  const lines = body.trimEnd().split("\n");
  assert.equal(lines.length, 2);
  const first = JSON.parse(lines[0] ?? "{}") as TurnRecord;
  const second = JSON.parse(lines[1] ?? "{}") as TurnRecord;
  assert.equal(first.turn, 1);
  assert.equal(second.config, "indexing");
});
