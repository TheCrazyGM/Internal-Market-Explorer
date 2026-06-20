<template>
  <div>
    <!-- controls -->
    <div class="controls">
      <input
        v-model="accountInput"
        class="account-input"
        placeholder="Hive account name"
        @keydown.enter="load"
      />
      <label class="pages-label">
        Pages
        <input
          v-model.number="pagesInput"
          type="number"
          min="1"
          :max="MAX_ACCOUNT_HISTORY_PAGES"
          class="pages-input"
        />
      </label>
      <button class="btn-load" :disabled="!accountInput.trim() || isFetching" @click="load">
        Load
      </button>
      <span v-if="isFetching" class="progress">
        page {{ progress.current }} / {{ progress.total }}
      </span>
      <span v-else-if="data" class="result-note">
        {{ data.totalTrades }} fills loaded
      </span>
    </div>

    <!-- P&L summary -->
    <div v-if="data" class="summary">
      <div class="stat">
        <span class="label">Total Fills</span>
        <span class="value">{{ data.totalTrades }}</span>
      </div>
      <div class="stat">
        <span class="label">Net HIVE</span>
        <span class="value" :class="data.netHive >= 0 ? 'pos' : 'neg'">
          {{ fmtNet(data.netHive) }} HIVE
        </span>
      </div>
      <div class="stat">
        <span class="label">Net HBD</span>
        <span class="value" :class="data.netHbd >= 0 ? 'pos' : 'neg'">
          {{ fmtNet(data.netHbd) }} HBD
        </span>
      </div>
      <div v-if="traderType" class="stat">
        <span class="label">Classification</span>
        <span class="value trader-type" :class="traderType.cls">{{ traderType.label }}</span>
      </div>
      <div class="stat">
        <span class="label">Buys / Sells</span>
        <span class="value">{{ stats?.buyCount }} / {{ stats?.sellCount }}</span>
      </div>
      <div class="stat">
        <span class="label">VWAP</span>
        <span class="value">{{ stats?.vwap }}</span>
      </div>
      <div class="stat">
        <span class="label">Mean Fill Price</span>
        <span class="value">{{ stats?.meanFillPrice }}</span>
      </div>
      <div v-if="stats?.buyVwap !== null" class="stat">
        <span class="label">Buy VWAP</span>
        <span class="value">{{ stats?.buyVwap }}</span>
      </div>
      <div v-if="stats?.sellVwap !== null" class="stat">
        <span class="label">Sell VWAP</span>
        <span class="value">{{ stats?.sellVwap }}</span>
      </div>
    </div>

    <!-- fills table -->
    <div v-if="data && data.fills.length" class="table-wrap">
      <div class="table-header">
        Fills — {{ account }}
        <span class="page-ctrl">
          <button :disabled="page === 0" @click="page--">‹</button>
          {{ page + 1 }} / {{ pageCount }}
          <button :disabled="page >= pageCount - 1" @click="page++">›</button>
        </span>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Role</th>
            <th>Paid</th>
            <th>Received</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in pageEntries" :key="f.trx_id + f.timestamp">
            <td class="ts">{{ fmtTime(f.timestamp) }}</td>
            <td :class="f.role">{{ f.role }}</td>
            <td class="neg">{{ f.paid.amount.toFixed(3) }} {{ f.paid.symbol }}</td>
            <td class="pos">{{ f.received.amount.toFixed(3) }} {{ f.received.symbol }}</td>
            <td class="mono">{{ f.price.toFixed(5) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="isError" class="error">Failed to load history. Check account name and try again.</div>
    <div v-if="isFetching && !data" class="loading">
      Fetching page {{ progress.current }} of {{ progress.total }}…
    </div>
    <div v-if="!params && !isFetching" class="empty">
      Enter a Hive account name and click Load.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  MAX_ACCOUNT_HISTORY_PAGES,
  useAccountFills,
} from '../composables/useAccountFills'

const PAGE_SIZE = 50

const accountInput = ref('')
const pagesInput   = ref(1)
const params = ref<{ account: string; pages: number } | null>(null)

const account = computed(() => params.value?.account ?? '')
const pages   = computed(() => params.value?.pages   ?? 10)

const { data, isFetching, isError, progress } = useAccountFills(account, pages)

const page = ref(0)

watch(params, () => { page.value = 0 })

function load() {
  const a = accountInput.value.trim()
  if (!a) return
  const rawPages = Number(pagesInput.value)
  const pages = Number.isFinite(rawPages) ? Math.trunc(rawPages) : 1
  pagesInput.value = Math.min(MAX_ACCOUNT_HISTORY_PAGES, Math.max(1, pages))
  params.value = { account: a, pages: pagesInput.value }
}

const pageCount = computed(() => Math.ceil((data.value?.fills.length ?? 0) / PAGE_SIZE))
const pageEntries = computed(() => {
  const fills = data.value?.fills ?? []
  return fills.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE)
})

const traderType = computed(() => {
  const d = data.value
  if (!d) return null
  const hive = d.netHive >= 0
  const hbd  = d.netHbd  >= 0
  if ( hive && !hbd) return { label: 'Net Accumulator',   cls: 'type-accum'  }
  if (!hive &&  hbd) return { label: 'Net Seller',        cls: 'type-seller' }
  if ( hive &&  hbd) return { label: 'Profitable Trader', cls: 'type-profit' }
  return                     { label: 'Losing Trader',    cls: 'type-loss'   }
})

const stats = computed(() => {
  const fills = data.value?.fills
  if (!fills?.length) return null

  let buyCount = 0, sellCount = 0
  let totalHive = 0, totalHbd = 0
  let buyHive = 0, buyHbd = 0
  let sellHive = 0, sellHbd = 0
  let sumPrice = 0

  for (const f of fills) {
    sumPrice += f.price
    if (f.received.symbol === 'HIVE') {
      buyCount++;  buyHive += f.received.amount;  buyHbd  += f.paid.amount
    } else {
      sellCount++; sellHive += f.paid.amount;      sellHbd += f.received.amount
    }
    totalHive += f.received.symbol === 'HIVE' ? f.received.amount : f.paid.amount
    totalHbd  += f.received.symbol === 'HBD'  ? f.received.amount : f.paid.amount
  }

  return {
    buyCount,
    sellCount,
    vwap:          (totalHive > 0 ? totalHbd  / totalHive  : 0).toFixed(5),
    meanFillPrice: (sumPrice / fills.length).toFixed(5),
    buyVwap:       buyHive  > 0 ? (buyHbd  / buyHive ).toFixed(5) : null,
    sellVwap:      sellHive > 0 ? (sellHbd / sellHive).toFixed(5) : null,
  }
})

function fmtNet(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return sign + n.toFixed(3)
}

function fmtTime(ts: string): string {
  return ts.replace('T', ' ')
}
</script>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
  margin-bottom: 12px;
  flex-wrap: wrap;
  font-size: 0.85rem;
}

.account-input {
  padding: 5px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
  width: 200px;
}

.pages-label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #555;
}

.pages-input {
  width: 64px;
  padding: 5px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
}

.btn-load {
  padding: 5px 14px;
  background: #e2007a;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: bold;
}
.btn-load:disabled { opacity: 0.5; cursor: default; }
.btn-load:not(:disabled):hover { background: #c0006a; }

.progress  { color: #888; font-size: 0.8rem; font-style: italic; }
.result-note { color: #aaa; font-size: 0.78rem; }

.summary {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  margin-bottom: 12px;
  font-size: 0.85rem;
}
.stat { display: flex; flex-direction: column; }
.label { font-size: 0.7rem; color: #999; text-transform: uppercase; letter-spacing: 0.05em; }
.value { font-weight: bold; color: #333; }
.pos { color: #00a050; }
.neg { color: #dc1e1e; }

.trader-type { font-size: 0.78rem; padding: 1px 6px; border-radius: 3px; display: inline-block; }
.type-accum  { background: #e6f4ea; color: #1a7a3a; }
.type-seller { background: #fdecea; color: #b71c1c; }
.type-profit { background: #e8f5e9; color: #1b5e20; font-weight: 900; }
.type-loss   { background: #fce4e4; color: #7f0000; }

.table-wrap { overflow-x: auto; }

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: #f5f5f5;
  border: 1px solid #e8e8e8;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  font-size: 0.8rem;
  font-weight: bold;
  color: #555;
}

.page-ctrl { display: flex; align-items: center; gap: 4px; font-weight: normal; }
.page-ctrl button {
  border: 1px solid #ccc; background: #f0f0f0; border-radius: 3px;
  padding: 1px 6px; cursor: pointer; font-size: 0.85rem;
}
.page-ctrl button:disabled { opacity: 0.35; cursor: default; }

.table { border-collapse: collapse; width: 100%; font-size: 0.78rem; }
.table th, .table td { border: 1px solid #e8e8e8; padding: 3px 8px; text-align: right; }
.table th:first-child, .table td:first-child { text-align: left; }
.table tr:nth-child(even) { background: #fafafa; }

.ts   { font-family: monospace; font-size: 0.74rem; text-align: left; white-space: nowrap; }
.mono { font-family: monospace; }
.maker  { color: #777; font-size: 0.74rem; }
.taker  { color: #555; font-size: 0.74rem; }

.loading { padding: 40px; text-align: center; color: #aaa; font-size: 0.9rem; }
.error   { padding: 20px; text-align: center; color: #dc1e1e; font-size: 0.85rem; }
.empty   { padding: 40px; text-align: center; color: #bbb; font-size: 0.85rem; }
</style>
