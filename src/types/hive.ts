export interface TradeAmount {
  amount: string
  nai: string   // "@@000000013" = HBD, "@@000000021" = HIVE
  precision: number
}

export interface Trade {
  date: string
  current_pays: TradeAmount
  open_pays: TradeAmount
  maker: string
  taker: string
}

export interface GetRecentTradesResponse {
  trades: Trade[]
}

export interface GetTradeHistoryResponse {
  trades: Trade[]
}

export interface UserVolume {
  name: string
  hive: number
  hbd: number
}

export interface MarketData {
  users: UserVolume[]
  trades: Trade[]
}

export interface HiveAsset {
  amount: string
  nai: string
  precision: number
}

export interface OrderBookEntry {
  order_price: {
    base: HiveAsset
    quote: HiveAsset
  }
  real_price: string   // decimal string e.g. "0.04928000000000000"
  hive: number         // millis
  hbd: number          // millis
  created: string      // ISO-8601, no Z
}

export interface GetOrderBookResponse {
  bids: OrderBookEntry[]   // sorted highest→lowest price
  asks: OrderBookEntry[]   // sorted lowest→highest price
}

export interface LimitOrder {
  id: number
  created: string      // ISO-8601, no Z
  expiration: string   // ISO-8601, no Z
  seller: string       // Hive account name
  orderid: number
  for_sale: number     // millis of base asset
  sell_price: {
    base: HiveAsset    // asset being sold
    quote: HiveAsset   // asset wanted in return
  }
}

export interface ListLimitOrdersResponse {
  orders: LimitOrder[]
}

/** Normalised order ready for display and charting */
export interface NormalisedOrder {
  seller: string
  price: number        // HBD per HIVE
  hive: number         // HIVE amount (display units)
  hbd: number          // HBD amount (display units)
  created: string
  expiration: string
  isBid: boolean
}

// ── condenser_api.get_account_history / fill_order ──────────────────────────

export interface FillOrderOp {
  current_owner:   string   // taker
  current_orderid: number
  current_pays:    string   // human-readable e.g. "602.975 HIVE"
  open_owner:      string   // maker
  open_orderid:    number
  open_pays:       string   // human-readable e.g. "29.787 HBD"
}

export interface AccountHistoryEntry {
  op:         ['fill_order', FillOrderOp]
  block:      number
  trx_id:     string
  op_in_trx:  number
  timestamp:  string   // ISO-8601, no Z
  virtual_op: boolean
}

export type AccountHistoryResult = [number, AccountHistoryEntry][]

// ── Processed fill for display / P&L ────────────────────────────────────────

export interface AssetAmount {
  amount: number
  symbol: 'HIVE' | 'HBD'
}

export interface AccountFill {
  timestamp: string
  trx_id:    string
  role:      'maker' | 'taker'
  paid:      AssetAmount
  received:  AssetAmount
  price:     number   // HBD per HIVE
}

export interface AccountFillsData {
  fills:       AccountFill[]
  netHive:     number   // positive = net HIVE gained, negative = net HIVE spent
  netHbd:      number   // positive = net HBD gained, negative = net HBD spent
  totalTrades: number
}
