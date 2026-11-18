// Sharp-dip mean-reversion bot for make.fun btc-race-24h-20261118-1444.
//
// Strategy (long only, one position, cbBTC/USDC, 1-minute bars):
//   * Idle almost all the time. Enter all-in only after a sharp fast drop:
//     the latest close is at least 80 bps below the highest close of the
//     last 6 bars (current bar included). Sharp 5-minute drops mean-revert
//     on the dev window (a >=80 bps drop in 5 min was followed on average
//     by a +50..+120 bps bounce over the next 15-30 min); smaller dips do
//     not clear the ~26-32 bps round-trip cost, so they are ignored.
//   * Exit the whole position on the first of:
//       - take profit: close >= entry close + 100 bps
//       - stop loss:   close <= entry close -  80 bps
//       - trailing:    close >= 50 bps below the highest close since entry
//       - time stop:   45 bars held
//   * No new entries once seq >= 1420 (a 1440-bar window): a position
//     opened in the last ~20 bars would be flattened at the last close
//     before any bounce can develop, which cost $3.49 on the dev window.
//
// All decisions use integer (bigint) arithmetic on the bar closes only:
// no wall clock, no network, no files, no randomness, no environment.
// The same bars therefore always produce the same orders.
//
// Entrypoint: node /bot/main.ts (Node 22, TypeScript via type stripping,
// erasable syntax only). vendor/makefun-bars.ts is a byte-identical copy
// of the kit SDK (sdk/makefun-bars.ts).

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const DROP_BPS = 80n; // entry: close this far below the 6-bar high
const LOOKBACK_BARS = 6; // bars in the high window, current bar included
const TAKE_PROFIT_BPS = 100n;
const STOP_LOSS_BPS = 80n;
const TRAIL_BPS = 50n; // exit once close falls this far below the peak since entry
const MAX_HOLD_BARS = 45;
const NO_ENTRY_FROM_SEQ = 1420;
const MAX_SLIPPAGE_BPS = 200; // 1-min moves on dev were at most ~64 bps; 200 is safe headroom

// Closes seen so far (bigint, price_scale units), bounded tail.
const closes: bigint[] = [];
let inPosition = false;
let entryClose = 0n;
let peakClose = 0n;
let heldBars = 0;

await runBars({
  onBatch(state: BarsState, _batch: Batch): OrderInput[] {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    if (closes.length > 64) closes.splice(0, closes.length - 64);
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined && held.qty > 0n) {
      inPosition = true;
    } else if (held === undefined) {
      inPosition = false;
    }

    if (inPosition) {
      if (entryClose === 0n) {
        // Holding without a recorded entry (should not happen: entries
        // are only made by this bot). Treat the first close seen while
        // holding as the entry.
        entryClose = close;
        peakClose = close;
        heldBars = 0;
      }
      heldBars += 1;
      if (close > peakClose) peakClose = close;
      const retBps = ((close - entryClose) * 10000n) / entryClose;
      const trailBps = ((peakClose - close) * 10000n) / peakClose;
      if (
        retBps >= TAKE_PROFIT_BPS ||
        retBps <= -STOP_LOSS_BPS ||
        trailBps >= TRAIL_BPS ||
        heldBars >= MAX_HOLD_BARS
      ) {
        inPosition = false;
        entryClose = 0n;
        peakClose = 0n;
        heldBars = 0;
        return [{ side: 'sell', symbol: SYMBOL, qty: held!.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Flat: look for a sharp-dip entry.
    if (state.seq >= NO_ENTRY_FROM_SEQ) return [];
    if (closes.length < LOOKBACK_BARS) return [];
    let high = closes[closes.length - LOOKBACK_BARS];
    for (let i = closes.length - LOOKBACK_BARS + 1; i < closes.length; i++) {
      if (closes[i] > high) high = closes[i];
    }
    const dropBps = ((high - close) * 10000n) / close;
    if (dropBps < DROP_BPS) return [];
    let notional = state.cash;
    const room = state.weightRoom(SYMBOL);
    if (room < notional) notional = room;
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
    if (notional < minNotional || notional <= 0n) return [];
    inPosition = true;
    entryClose = close;
    peakClose = close;
    heldBars = 0;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
