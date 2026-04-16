# pi-cursor-agent (Miyagi fork)

Cursor Agent provider extension for [pi](https://github.com/badlogic/pi-mono), aggregated through [`pi-miyagi`](https://github.com/dhimebauch_FirstAm/pi-miyagi) for the First American Miyagi team.

Lets you drive Pi with your existing Cursor subscription — Claude, GPT, Gemini, Grok, Composer, and Kimi models, including thinking/reasoning variants.

## Why this fork exists

Upstream `pi-cursor-agent` doesn't yet expose the latest Cursor model families to Pi's `/model` picker, so team members get stuck at a 200k default context window and fall through to a generic pricing entry. This fork tracks upstream closely and adds only what's needed to keep the supported Miyagi model baseline current.

### Delta vs upstream `pi-cursor-agent@0.4.4`

- Adds the **Claude Opus 4.7** family (`low`, `medium`, `high`, `xhigh`, `max`, each with thinking variants) — all 1M context.
- Fixes **GPT-5.4** / **GPT-5.4 Fast** context window from 272k → 1M to match Cursor's displayed capacity.
- **Aggressive YOLO shell approval**: `confirmIfDangerous` in `src/bridge/cursor-to-pi/executors/shell.ts` always returns `true`, so cursor-agent never opens a `ctx.ui.confirm` dialog for `sudo`, `rm -rf`, `curl | sh`, etc. Pi itself is a YOLO runtime and the extra prompt was pure friction for the Miyagi team. Flip the helper back to the upstream implementation if you want the safety net.
- **Real server-reported token usage**: Cursor's interaction stream only emits an output `token-delta`; upstream therefore leaves `usage.input = 0` and Pi's footer reads `0.0%/<window>` forever. Every `ConversationStateStructure` checkpoint, though, carries an authoritative `ConversationTokenDetails { used_tokens, max_tokens }` from Cursor's server. This fork surfaces that through a new `token-details` channel event in `src/provider/agent-stream-hook.ts`, handles it in `consumeUntilBoundary` (`src/provider/stream.ts`), and primes the first assistant message of each resumed turn from the persisted `agentStore` so the footer never falls back to 0. No heuristic estimation — the number you see is what Cursor's server is enforcing.
- **Cursor-verified context windows**: While wiring the above we observed that Cursor enforces 200k for the entire Claude Opus 4.7 family and 272k for GPT-5.4 / -fast, not the 1M values we originally guessed. `src/provider/model-override.ts` now matches reality so the footer's `%` denominator lines up with the real compaction boundary.

Everything else mirrors upstream `pi-frontier/pi-cursor-agent`.

## Installation

This package is aggregated through `pi-miyagi`:

```sh
pi install git:git@github.com:dhimebauch_FirstAm/pi-miyagi
```

To install it directly without the rest of Miyagi:

```sh
pi install git:https://github.com/xXJSONDeruloXx/pi-cursor-agent
```

## Authentication

1. Open pi and enter `/login`.
2. Select **Cursor Agent** from the provider list.
3. A browser window will open to the Cursor login page — sign in with your Cursor account.

## Requirements

- `pi >= 0.52.10`
- Cursor subscription

## Upstream

- Canonical source: https://github.com/sudosubin/pi-frontier (`pi-cursor-agent` subdirectory)
- Published as `pi-cursor-agent` on npm by `sudosubin`.
- This fork preserves the original MIT license and copyright.

When Cursor adds new model families, we update this fork first; longer-term changes should flow back into upstream.

## License

MIT — see [LICENSE](./LICENSE). Copyright (c) 2026 Subin Kim (upstream), with fork contributions by the First American Miyagi team.
