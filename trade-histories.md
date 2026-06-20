# Profit Tracker — Research & Design Plan

A client-side tool for loading Hive internal market trade history by account and computing
P&L and trading metrics. Built as the Profit Tracker tab in the Internal Market Explorer.

---

## Status: ✅ Built (Phase 1 complete)

Core fetch, P&L accumulation, and summary UI are live. See:
- `src/composables/useAccountFills.ts` — pagination, filtering, P&L accumulation
- `src/components/ProfitTracker.vue` — UI: controls, summary stats, paginated fills table

---

## Design Decisions

### 1. Data Source ✅ DECIDED

**`condenser_api.get_account_history` filtered to `fill_order` ops.**

`get_trade_history` has no per-account filter — you'd fetch all market trades and discard most.
`get_account_history` is native per-account, walks backwards from most recent, and `fill_order`
virtual ops capture exactly what we need.

**Server-side filter:** `opFilter(OP.fill_order)` from `@srbde/pollen` (added in 1.0.4).
Passes BigInt bitmask (`2^57`) safely through pollen's serializer — the IEEE 754 precision
hazard (V8 Ryu producing `144115188075855870` instead of `144115188075855872`) is handled
internally. No client-side discard needed.

### 2. P&L Definition ✅ DECIDED

**Only `fill_order` ops count — open orders are excluded from P&L.**

**Report in both bases simultaneously:**

| Basis | What it shows |
|---|---|
| HBD basis | Net HBD gained/spent |
| HIVE basis | Net HIVE accumulated or spent |

**Core P&L math per fill:**
- If `current_owner == account` (taker): paid `current_pays`, received `open_pays`
- If `open_owner == account` (maker): paid `open_pays`, received `current_pays`
- Net position = sum of all received amounts minus sum of all paid amounts, per asset

**No cost-basis method needed** — net flow per asset is the source of truth.

### 3. Client-Side Storage ✅ DECIDED

**TanStack Query cache only (no persistence) for initial build.**

`localStorage` ruled out (5 MB cap). `IndexedDB` is the right long-term answer but adds
complexity. Cache lives for the session; user re-fetches on reload. IndexedDB can be layered in.

### 4. Multi-Account Support ✅ DECIDED

**Single account at a time.**

### 5. Fetch Depth ✅ DECIDED

**Page-count controlled by the user. Default: 1 page.**

Each page = 1 API call = up to 1000 `fill_order` ops (server-side filtered).
UI exposes a numeric input and shows per-page progress (`page X / N`).

---

## Summary Metrics — Implemented

All computed client-side in `ProfitTracker.vue` from the `fills` array.

| Metric | Label | Definition |
|---|---|---|
| Total fills | Total Fills | Count of `fill_order` entries loaded |
| Net HIVE | Net HIVE | HIVE received minus HIVE paid across all fills |
| Net HBD | Net HBD | HBD received minus HBD paid across all fills |
| Classification | Classification | Derived from sign of Net HIVE × Net HBD (see below) |
| Buy / sell count | Buys / Sells | Fills where received=HIVE vs received=HBD |
| VWAP | VWAP | `total HBD traded / total HIVE traded` (volume-weighted) |
| Mean fill price | Mean Fill Price | Arithmetic mean of per-fill HBD/HIVE price (count-weighted, not size-weighted) |
| Buy VWAP | Buy VWAP | `HBD spent / HIVE received` across buy fills only |
| Sell VWAP | Sell VWAP | `HBD received / HIVE paid` across sell fills only |

### Trader Classification

Derived from the signs of Net HIVE and Net HBD:

| Net HIVE | Net HBD | Classification | Color |
|---|---|---|---|
| + | − | Net Accumulator | light green |
| − | + | Net Seller | light red |
| + | + | Profitable Trader | dark green (bold) |
| − | − | Losing Trader | dark red |

Both-positive means the account bought low and sold high — they extracted value from the spread
and netted ahead in both assets simultaneously. Both-negative is the reverse. These cases can
only appear when an account has traded in both directions over the loaded window.

### VWAP vs Mean Fill Price

These two numbers will diverge when trade sizes vary widely:
- **VWAP** is the economically meaningful average — it weights each fill by its HIVE volume.
  `total HBD / total HIVE`. A large trade at 0.5 dominates a dozen tiny trades at 0.3.
- **Mean Fill Price** weights each fill equally regardless of size. Useful for understanding
  how often the account traded at various price levels, independent of position sizing.

---

## Fills Table

Paginated at 50 fills per page, newest-first.

| Column | Source | Notes |
|---|---|---|
| Time | `entry.timestamp` | ISO-8601 without Z, displayed as `YYYY-MM-DD HH:MM:SS` |
| Role | maker / taker | maker = resting order; taker = aggressor |
| Paid | `paid.amount paid.symbol` | red — what the account gave up |
| Received | `received.amount received.symbol` | green — what the account got |
| Price | `hbd / hive` | HBD per HIVE, computed from the fill amounts |

**Pagination ordering:** pages are fetched newest-first (walking backwards via
`start = batch[0][0] - 1`). Each batch is reversed before appending so the final
array is newest-first across all pages, with no timestamp discontinuity at page boundaries.

---

## Research Tasks

### A. Probe `condenser_api.get_account_history` for `fill_order` ops ✅ DONE

See original research notes below.

### B. Probe `condenser_api.get_open_orders` ✅ DONE

See original research notes below.

### C. Estimate data volume ✅ DONE

See original research notes below.

### D. Define P&L calculation ✅ DONE

Implemented as described above. No cost-basis method needed — net flows are the source of truth.

---

## Original Research Notes

### A. `fill_order` op structure

`fill_order` is a **virtual operation** (`virtual_op: true`) emitted when a limit order is matched.
Appears in **both** maker and taker account history.

```ts
interface FillOrderOp {
  current_owner:  string   // taker
  current_orderid: number
  current_pays:   string   // e.g. "602.975 HIVE"
  open_owner:     string   // maker
  open_orderid:   number
  open_pays:      string   // e.g. "29.787 HBD"
}
```

Key findings:
- Amounts are human-readable strings with symbol, NOT millis
- `condenser_api.get_account_history(account, start, limit, filterLow, filterHigh)`
- `start = -1` = most recent; paginate backwards using `batch[0][0] - 1`
- `limit` max = 1000
- Op filter bitmask: `fill_order` = bit 57 = `2^57` — must use BigInt (pollen 1.0.4 handles this)

### B. `condenser_api.get_open_orders`

Single call, no pagination, returns all open orders for one account.
`sell_price.base` / `.quote` are human-readable strings (not `HiveAsset` millis objects).
`for_sale` = remaining millis; `sell_price.base` = original amount (detects partial fills).

### C. Data volume

| Account | Total ops | fill_order % | Est. total fills |
|---|---|---|---|
| steembasicincome | 2,246,441 | ~20% | ~460,000 |
| konvik-hbd | 9,246,029 | ~10% | ~915,000 |
| droida | 6,309,032 | ~2% | ~114,000 |
| vihan | 147,465 | ~34% | ~51,000 |
| econo | 1,664,667 | ~2% | ~33,000 |

- 1 page (1000 ops) ≈ 382 KB JSON
- `localStorage` ruled out; IndexedDB is the long-term storage answer
- Full backfill of a bot account = 2,000–9,000 API calls → incremental sync essential

---

## Next Steps

1. ~~Build core fetch and P&L display~~ ✅ Done
2. Consider IndexedDB persistence for session-to-session caching
3. Consider incremental sync (load recent fills fast, offer "load more" for deeper history)
4. Consider open orders panel alongside fill history (`get_open_orders` already researched)
5. Possible: date-range filter on the loaded fills (client-side, no extra API calls)
6. Possible: chart of net position or price over time
