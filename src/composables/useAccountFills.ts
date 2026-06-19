import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { nodePool } from '../lib/nodePool'
import { parseAsset } from '../lib/marketUtils'
import type { Ref } from 'vue'
import type { AccountHistoryResult, AccountFill, AccountFillsData } from '../types/hive'

// fill_order virtual op bitmask: bit 57 = 2^57 (exactly representable in IEEE 754)
const FILL_ORDER_FILTER = 2 ** 57

async function fetchAccountFills(
  account: string,
  pages: number,
  progress: Ref<{ current: number; total: number }>,
): Promise<AccountFillsData> {
  progress.value = { current: 0, total: pages }
  await nodePool.init()

  // Sequential fetch: each page returns up to 1000 fill_order ops (server-filtered).
  // Page N's start index depends on the lowest index returned by page N-1,
  // so pages cannot be parallelised. Node pool still provides failover.
  const fills: AccountFill[] = []
  let start = -1

  for (let page = 0; page < pages; page++) {
    const batch = await nodePool.call<AccountHistoryResult>(
      'condenser_api', 'get_account_history',
      [account, start, 1000, FILL_ORDER_FILTER, 0]
    )

    progress.value = { current: page + 1, total: pages }

    if (!batch.length) break

    for (const [, entry] of batch) {
      const op = entry.op[1]

      const isTaker = op.current_owner === account
      const paid     = parseAsset(isTaker ? op.current_pays : op.open_pays)
      const received = parseAsset(isTaker ? op.open_pays    : op.current_pays)

      const hive = received.symbol === 'HIVE' ? received.amount : paid.amount
      const hbd  = received.symbol === 'HBD'  ? received.amount : paid.amount

      fills.push({
        timestamp: entry.timestamp,
        trx_id:    entry.trx_id,
        role:      isTaker ? 'taker' : 'maker',
        paid,
        received,
        price: hbd / hive,
      })
    }

    if (batch.length < 1000) break
    start = batch[0][0] - 1  // lowest index in this page; step back for next page
  }

  // Already newest-first within each page; reverse so overall order is newest-first
  fills.reverse()

  let netHive = 0
  let netHbd  = 0
  for (const fill of fills) {
    if (fill.received.symbol === 'HIVE') {
      netHive += fill.received.amount
      netHbd  -= fill.paid.amount
    } else {
      netHive -= fill.paid.amount
      netHbd  += fill.received.amount
    }
  }

  return { fills, netHive, netHbd, totalTrades: fills.length }
}

export function useAccountFills(account: Ref<string>, pages: Ref<number>) {
  const progress = ref({ current: 0, total: 0 })

  const query = useQuery({
    queryKey: computed(() => ['accountFills', account.value, pages.value]),
    queryFn:  () => fetchAccountFills(account.value, pages.value, progress),
    enabled:  computed(() => account.value.length > 0),
    staleTime:           Infinity,
    refetchOnWindowFocus: false,
    retry: 3,
  })

  return { ...query, progress }
}
