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
