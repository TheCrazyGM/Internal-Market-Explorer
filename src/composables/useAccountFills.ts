import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { nodePool } from '../lib/nodePool'
import { parseAsset } from '../lib/marketUtils'
import type { Ref } from 'vue'
import type { AccountHistoryResult, AccountFill, AccountFillsData, FillOrderOp } from '../types/hive'

const BATCH_SIZE     = 1000
const FILL_ORDER_LOW = 0x200000000000000  // bit 57 of operation_filter_low (2^57)

function parseBatch(account: string, batch: AccountHistoryResult): AccountFill[] {
  const fills: AccountFill[] = []
  for (const [, entry] of batch) {
    if (entry.op[0] !== 'fill_order') continue
    const op = entry.op[1] as FillOrderOp

    const isTaker  = op.current_owner === account
    const paid     = parseAsset(isTaker ? op.current_pays : op.open_pays)
    const received = parseAsset(isTaker ? op.open_pays    : op.current_pays)
    const hive     = received.symbol === 'HIVE' ? received.amount : paid.amount
    const hbd      = received.symbol === 'HBD'  ? received.amount : paid.amount

    fills.push({
      timestamp: entry.timestamp,
      trx_id:    entry.trx_id,
      role:      isTaker ? 'taker' : 'maker',
      paid,
      received,
      price: hbd / hive,
    })
  }
  return fills
}

async function fetchAccountFills(
  account: string,
  pages: number,
  progress: Ref<{ current: number; total: number }>,
): Promise<AccountFillsData> {
  progress.value = { current: 0, total: pages }
  await nodePool.init()

  const fetchPage = (start: number) => {
    console.log('[fills] filter JSON:', JSON.stringify(FILL_ORDER_LOW))
    return nodePool.call<AccountHistoryResult>(
      'condenser_api', 'get_account_history',
      [account, start, BATCH_SIZE, FILL_ORDER_LOW, 0]
    )
  }

  // Sequential: each page's start index depends on the previous page's lowest index.
  // With server-side filter, a page of 1000 fills can span thousands of raw history
  // indices, so start positions cannot be pre-computed for parallel fetching.
  const fills: AccountFill[] = []
  let start = -1

  for (let page = 0; page < pages; page++) {
    const batch = await fetchPage(start)
    progress.value = { current: page + 1, total: pages }

    if (!batch.length) { console.log('[fills] page', page, 'empty batch — break'); break }
    console.log('[fills] page', page, 'batch length:', batch.length, 'first item:', batch[0])
    const parsed = parseBatch(account, batch)
    console.log('[fills] page', page, 'parsed fills:', parsed.length)
    fills.push(...parsed)
    if (batch.length < BATCH_SIZE) break
    start = batch[0][0] - 1
  }

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
