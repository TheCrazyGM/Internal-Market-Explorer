// Re-export pollen types used across composables so import paths stay consistent
export type { Trade, HiveAsset, LimitOrder, ListLimitOrdersResponse, FillOrderOp, AccountHistoryEntry } from '@srbde/pollen'

export interface UserVolume {
  name: string
  hive: number
  hbd: number
}

export interface MarketData {
  users: UserVolume[]
  trades: import('@srbde/pollen').Trade[]
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
