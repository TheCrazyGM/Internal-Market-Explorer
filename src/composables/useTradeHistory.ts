import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { client } from '../lib/hiveClient'
import { accumulateTrades, toMarketData } from '../lib/marketUtils'
import type { Ref } from 'vue'
import type { GetTradeHistoryResponse } from '../types/hive'

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().substring(0, 19)
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchTradeHistory(startTi: number, endTi: number) {
  const allUsers: Record<string, [number, number]> = {}
  const allTrades: ReturnType<typeof toMarketData>['trades'] = []
  let cursor = startTi

  while (true) {
    const res = await client.call<GetTradeHistoryResponse>(
      'market_history_api', 'get_trade_history',
      { limit: 1000, start: formatDate(cursor), end: formatDate(endTi) }
    )
    const batch = res.trades ?? []
    if (batch.length === 0) break

    const { users } = accumulateTrades(batch)
    for (const [name, [hive, hbd]] of Object.entries(users)) {
      allUsers[name] ??= [0, 0]
      allUsers[name][0] += hive
      allUsers[name][1] += hbd
    }
    allTrades.push(...batch)

    for (const item of batch) {
      cursor = Math.max(cursor, new Date(item.date + 'Z').getTime())
    }
    cursor++

    if (batch.length < 1000 || cursor >= endTi) break
    await delay(250)
  }

  return toMarketData(allUsers, allTrades)
}

export interface DateRange {
  from: number
  to: number
}

export function useTradeHistory(dateRange: Ref<DateRange | null>) {
  return useQuery({
    queryKey: computed(() => ['tradeHistory', dateRange.value]),
    queryFn: () => fetchTradeHistory(dateRange.value!.from, dateRange.value!.to),
    enabled: computed(() => dateRange.value !== null),
    retry: 3,
  })
}
