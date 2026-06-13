# pi-cache-meter

> **Distribution mirror.** Developed in a private source-of-truth repo and synced here for distribution
> (current sync: `pi_config@d653613`, 2026-06-12). The `main` branch is force-synced — please don't
> target PRs at it directly; file an [issue](https://github.com/psmfd/pi-cache-meter/issues)
> instead and fixes will land via the next sync.

A **read-only** pi extension that records per-turn token usage to JSONL, for measuring prompt-cache hit ratios. Provider prompt caching prices cached input tokens ~10× below fresh; any feature that rewrites the cached message **prefix** on each call invalidates the cache forward and can cost more than it removes. This extension captures the per-turn usage you need to verify your extensions and workflows don't do that.

## Install

```bash
pi install git:github.com/psmfd/pi-cache-meter@v0.1.0
```

Or try it for a single session without installing:

```bash
pi -e git:github.com/psmfd/pi-cache-meter
```

No build step — pi loads the TypeScript directly. The pi SDK is bundled by pi itself; this extension has no runtime dependencies of its own.

## What it does

When `CACHE_METER_CONFIG` is set, the `message_end` handler appends one JSONL record per **assistant** turn to `~/.pi/agent/extensions/cache-meter/turns.jsonl`, tagged with that config slot:

```jsonc
{ "ts":"…","turn":3,"model":"claude-opus-4-8","provider":"anthropic",
  "input":1200,"cacheRead":8000,"cacheWrite":0,"output":300,"costTotal":0.014,"config":"baseline" }
```

`input` is **fresh** (uncached) input only, so the cache-hit ratio is `cacheRead / (cacheRead + input)`.

**Inert by default.** With `CACHE_METER_CONFIG` unset the extension registers nothing and records nothing — zero overhead in normal sessions.

**Observational only.** The `message_end` handler returns `undefined` and never a replacement `{ message }`. A measurement tool that rewrote the message would itself churn the prefix it is meant to measure — that invariant is the whole point, so the recorder must not break it.

## Measuring

Run real pi sessions under each configuration you want to compare, with `CACHE_METER_CONFIG` naming the slot:

```bash
CACHE_METER_CONFIG=baseline pi    # …run a representative prompt battery, exit…
CACHE_METER_CONFIG=candidate pi   # …repeat the same battery…
```

Then compare per-config cache-hit ratio (`cacheRead / (cacheRead + input)`), fresh-input totals, and cost from the JSONL — `jq` is plenty:

```bash
jq -s 'group_by(.config)[] | {config: .[0].config,
  chr: ((map(.cacheRead) | add) / ((map(.cacheRead) | add) + (map(.input) | add))),
  freshInput: (map(.input) | add), cost: (map(.costTotal) | add)}' \
  ~/.pi/agent/extensions/cache-meter/turns.jsonl
```

## Provider note

Authoritative cache-hit ratio requires a provider that reports cache tokens — the **Anthropic** path (`anthropic-messages`) populates `cacheRead`/`cacheWrite`; OpenAI-style paths populate `cacheRead` only (`cacheWrite` always 0); the github-copilot SDK currently reports both as 0. For providers reporting neither, treat the cache-hit gate as inconclusive and compare fresh-input totals instead.

## Files

| File | Role |
| --- | --- |
| `index.ts` | Factory: gated `message_end` recorder (read-only) + `session_start` turn reset. |
| `record.ts` | Pure turn-record construction from `message.usage` (no I/O, no clock). |
| `state.ts` | Append-only JSONL writer under the cache-meter namespace. |
| `types.ts` | Usage/record structural types. |

## Development

```bash
npm install
npm run typecheck
npm test
```

## License

[MIT](LICENSE)
