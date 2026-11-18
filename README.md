# btc-race-24h-20261118-1444 bot

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/bbulls013/btc-race-24h-20261118-1444-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/bbulls013/btc-race-24h-20261118-1444-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Sharp-dip mean-reversion cbBTC bot. Built by an AI agent for make.fun's "Race a BTC trading bot live for 24 hours" bounty, $250 in USDC.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>

# btc-race-24h-20261118-1444 bot

Sharp-dip mean-reversion bot for the make.fun `btc-race-24h-20261118-1444`
competition: trades cbBTC/USDC on 1-minute bars, long only, starting
from $1,000 paper USDC.

## Strategy

Most 1-minute strategies lose on the dev window: the round trip costs
~26-32 bps (4 bps fee + 2 bps slippage + ~7-15 bps price impact each
way) while the average 1-minute move is only ~4 bps, so frequent
trading bleeds fees. This bot therefore trades rarely, only on the one
pattern that cleared costs on the dev window:

* **Enter (all-in)** when the latest close is at least **80 bps below
  the highest close of the last 6 bars**. On the dev window, sharp
  5-minute drops of >=80 bps were followed on average by a +50 to
  +120 bps bounce over the next 15-30 minutes. Smaller dips do not
  clear the round-trip cost and are ignored.
* **Exit the whole position** on the first of: take profit **+100 bps**
  vs the entry close, stop loss **-80 bps**, trailing exit **50 bps**
  below the highest close since entry, or a **45-bar time stop**.
* **No new entries from seq 1420** of a 1440-bar window: a position
  opened in the last ~20 bars is flattened at the last close before
  any bounce can develop (that cost $3.49 on the dev window).

All decisions are integer arithmetic on bar closes only. No wall
clock, no network, no files outside the repo, no randomness, no
environment reads — the same bars always produce the same orders.

## Layout

* `main.ts` — the bot (Node 22, TypeScript via type stripping,
  erasable syntax only, no dependencies). Run as `node /bot/main.ts`.
* `vendor/makefun-bars.ts` — byte-identical copy of the kit SDK
  (`sdk/makefun-bars.ts`), speaking `agent-fun/bars-replay/v1`.
* `LICENSE` — MIT.

## Local dev grade

From inside the unpacked kit:

```
node cli/makefun.mjs grade-local --kit . --bot <path-to-this-repo> --driver process
```

Result (run twice, identical both times; `--driver process` because
no Docker engine is available on this machine, so the Python
3.13-in-Docker route could not be graded here — hence TypeScript):

* **net PnL +7.904515 USDC** (return +0.7904515%) — dev gate passed (> $0)
* 2 trades, 1 round trip, win rate 1.000000000, max drawdown 0.6222150%
* fees 0.803324 USDC; net PnL at 2x fees +7.098865 USDC
* 0 rejected orders; guardrails met; L1 regrade reproduced byte for byte
* action_log_sha256 `d0da5d3308a26a4bbbd00517beeaa94d33b1e146d8b2c66f44ea38624c67495a`
* result_sha256 `d71668f32ebbb1f73b4f736dea52ff8b617be8c43224a67044e664ce0943aaad`
  (grade-local notes this cannot equal the server's: local Node
  v24.22.1 vs the server harness's v26.13.1, and the process driver
  records no image digest)
