/**
 * cache-meter/state.ts — append-only JSONL log for measurement turns.
 *
 * Records land at ~/.pi/agent/extensions/cache-meter/turns.jsonl (the
 * per-extension subtree, ADR-0019/ADR-0030), which resolves into this repo via
 * the setup.sh `~/.pi → repo` symlink and is therefore gitignored. `agentDir`
 * is injectable so the I/O unit-tests against a temp dir.
 */

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { toJsonl } from "./record.ts";
import type { TurnRecord } from "./types.ts";

const NAMESPACE = "cache-meter";
const LOG_BASENAME = "turns.jsonl";

/** Resolve the JSONL log path for the cache-meter namespace. */
export function logPath(agentDir?: string): string {
  const base = agentDir ?? join(homedir(), ".pi", "agent");
  return join(base, "extensions", NAMESPACE, LOG_BASENAME);
}

/** Append one turn record as a JSONL line, creating the directory as needed. */
export async function appendTurn(record: TurnRecord, agentDir?: string): Promise<void> {
  const file = logPath(agentDir);
  await fs.mkdir(dirname(file), { recursive: true });
  await fs.appendFile(file, toJsonl(record), "utf8");
}
