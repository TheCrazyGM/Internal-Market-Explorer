import { useQuery } from '@tanstack/vue-query'
import { client } from '../lib/hiveClient'
import { accumulateTrades, toMarketData } from '../lib/marketUtils'

async function fetchRecentTrades() {
  const res = await client.market.getRecentTrades({ limit: 1000 })
  const { users, tradeList } = accumulateTrades(res.trades ?? [])
  return toMarketData(users, tradeList)
}

export function useRecentTrades(autoRefresh: { value: boolean }) {
  return useQuery({
    queryKey: ['recentTrades'],
    queryFn: fetchRecentTrades,
    refetchInterval: () => (autoRefresh.value ? 5_000 : false),
    retry: 7,
  })
}
