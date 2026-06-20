import { useQuery } from '@tanstack/vue-query'
import { client } from '../lib/hiveClient'
import { HBD_NAI, HIVE_NAI } from '@srbde/pollen'
import type { LimitOrder } from '@srbde/pollen'
import type { NormalisedOrder } from '../types/hive'

export interface OrderBook {
  bids: NormalisedOrder[]   // sorted highest→lowest price
  asks: NormalisedOrder[]   // sorted lowest→highest price
  raw: LimitOrder[]
}

function normalise(order: LimitOrder): NormalisedOrder {
  const base  = order.sell_price.base
  const quote = order.sell_price.quote
  const isBid = base.nai === HBD_NAI   // selling HBD to buy HIVE

  let hive: number, hbd: number, price: number
  if (isBid) {
    hbd   = Number(base.amount)  * 0.001
    hive  = Number(quote.amount) * 0.001
    price = hbd / hive
  } else {
    // selling HIVE (base = HIVE_NAI)
    hive  = Number(base.amount)  * 0.001
    hbd   = Number(quote.amount) * 0.001
    price = hbd / hive
  }

  return { seller: order.seller, price, hive, hbd, created: order.created, expiration: order.expiration, isBid }
}

async function fetchAllLimitOrders(): Promise<LimitOrder[]> {
  const all: LimitOrder[] = []
  let start: [string, number] = ['', 0]

  while (true) {
    const { orders: batch } = await client.database.listLimitOrders({ start, limit: 1000, order: 'by_account' })
    const slice = all.length === 0 ? batch : batch.slice(1)
    all.push(...slice)
    if (batch.length < 1000) break
    const last = batch[batch.length - 1]
    start = [last.seller, last.orderid]
  }

  return all
}

async function fetchOrderBook(): Promise<OrderBook> {
  const raw = await fetchAllLimitOrders()
  const normalised = raw.map(normalise)

  const bids = normalised
    .filter(o => o.isBid)
    .sort((a, b) => b.price - a.price)

  const asks = normalised
    .filter(o => !o.isBid)
    .sort((a, b) => a.price - b.price)

  return { bids, asks, raw }
}

export function useOrderBook() {
  return useQuery({
    queryKey: ['orderBook'],
    queryFn: fetchOrderBook,
    refetchInterval: 30_000,
    retry: 3,
  })
}
