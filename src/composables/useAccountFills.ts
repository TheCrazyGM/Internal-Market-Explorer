import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { OP, opFilter } from '@srbde/pollen'
import type { FillOrderOp } from '@srbde/pollen'
import { client } from '../lib/hiveClient'
import { parseAsset } from '../lib/marketUtils'
import type { Ref } from 'vue'
import type { AccountFill, AccountFillsData } from '../types/hive'

const BATCH_SIZE = 1000

function parseBatch(account: string, batch: [number, { op: [string, unknown]; trx_id: string; timestamp: string }][]): AccountFill[] {
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

  const filter = opFilter(OP.fill_order)
  const fills: AccountFill[] = []
  let start = -1

  for (let page = 0; page < pages; page++) {
    const batch = await client.database.getAccountHistory(account, start, BATCH_SIZE, filter)
    progress.value = { current: page + 1, total: pages }

    if (!batch.length) break
    const pageFills = parseBatch(account, batch)
    pageFills.reverse()        // newest-first within this page
    fills.push(...pageFills)   // page 1 (newest) then page 2 (older), etc.
    if (batch.length < BATCH_SIZE) break
    start = batch[0][0] - 1
  }

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
