import type { Trade, MarketData, UserVolume, AssetAmount } from '../types/hive'

export const HBD_NAI  = '@@000000013'
export const HIVE_NAI = '@@000000021'

export function accumulateTrades(trades: Trade[]): { users: Record<string, [number, number]>; tradeList: Trade[] } {
  const users: Record<string, [number, number]> = {}
  for (const item of trades) {
    const hbdCurrent = item.current_pays.nai === HBD_NAI
    const hbd  = Number(hbdCurrent ? item.current_pays.amount : item.open_pays.amount) * 0.001
    const hive = Number(hbdCurrent ? item.open_pays.amount   : item.current_pays.amount) * 0.001
    users[item.maker] ??= [0, 0]
    users[item.taker] ??= [0, 0]
    users[item.maker][0] += hive; users[item.maker][1] += hbd
    users[item.taker][0] += hive; users[item.taker][1] += hbd
  }
  return { users, tradeList: trades }
}

export function toMarketData(users: Record<string, [number, number]>, trades: Trade[]): MarketData {
  const userList: UserVolume[] = Object.entries(users)
    .map(([name, [hive, hbd]]) => ({ name, hive, hbd }))
    .sort((a, b) => b.hbd - a.hbd)
  return { users: userList, trades }
}

/** Parse a human-readable Hive asset string e.g. "602.975 HIVE" or "29.787 HBD" */
export function parseAsset(s: string): AssetAmount {
  const [amount, symbol] = s.split(' ')
  return { amount: Number(amount), symbol: symbol as 'HIVE' | 'HBD' }
}

export function toTime(t: string | number): number {
  if (typeof t === 'number') return t
  const lower = t.toLowerCase()
  if (lower.endsWith('m')) return Date.now() - 60_000      * Number(t.slice(0, -1))
  if (lower.endsWith('h')) return Date.now() - 3_600_000   * Number(t.slice(0, -1))
  if (lower.endsWith('d')) return Date.now() - 86_400_000  * Number(t.slice(0, -1))
  return new Date(t + 'Z').getTime()
}
