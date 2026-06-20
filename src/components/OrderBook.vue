<template>
  <div>
    <!-- summary strip -->
    <div v-if="data" class="summary">
      <div class="stat">
        <span class="label">Highest Bid</span>
        <span class="value bid">{{ fmtPrice(data.bids[0]?.price) }}</span>
      </div>
      <div class="stat">
        <span class="label">Lowest Ask</span>
        <span class="value ask">{{ fmtPrice(data.asks[0]?.price) }}</span>
      </div>
      <div class="stat">
        <span class="label">Spread</span>
        <span class="value">{{ spread }}</span>
      </div>
      <div class="stat">
        <span class="label">Total Bid HIVE</span>
        <span class="value">{{ totalBidHive }}</span>
      </div>
      <div class="stat">
        <span class="label">Total Ask HIVE</span>
        <span class="value">{{ totalAskHive }}</span>
      </div>
      <div class="stat">
        <span class="label">Total Orders</span>
        <span class="value">{{ data.raw.length }}</span>
      </div>
      <span v-if="isFetching" class="fetching">Refreshing…</span>
    </div>

    <!-- depth chart -->
    <div v-if="data" class="chart-toolbar">
      <span class="chart-label">Depth chart range:</span>
      <button
        v-for="opt in CLIP_OPTIONS"
        :key="opt"
        :class="['clip-btn', { active: clipPct === opt }]"
        @click="clipPct = opt"
      >{{ opt === 0 ? 'All' : `±${opt}%` }}</button>
      <span class="mid-note">mid {{ fmtPrice(mid) }}</span>
    </div>
    <div v-if="data" style="height: 380px; margin: 4px 0 4px;">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <p v-if="data" class="caveat">
      Depth chart represents all {{ data.raw.length }} open orders fetched from the Hive node
      (complete book — no per-side cap). Order book auto-refreshes every 30s.
    </p>

    <!-- order tables -->
    <div v-if="data" class="tables">
      <!-- bids -->
      <div class="side">
        <div class="side-header bid-header">
          Bids ({{ data.bids.length }})
          <span class="page-ctrl">
            <button :disabled="bidPage === 0" @click="bidPage--">‹</button>
            {{ bidPage + 1 }} / {{ bidPageCount }}
            <button :disabled="bidPage >= bidPageCount - 1" @click="bidPage++">›</button>
          </span>
        </div>
        <table class="table">
          <thead><tr><th>Seller</th><th>Price</th><th>HIVE</th><th>HBD</th><th>Age</th></tr></thead>
          <tbody>
            <tr v-for="o in bidPage_entries" :key="o.created + o.seller + o.price">
              <td class="account">{{ o.seller }}</td>
              <td class="bid">{{ fmtPrice(o.price) }}</td>
              <td>{{ o.hive.toFixed(3) }}</td>
              <td>{{ o.hbd.toFixed(3) }}</td>
              <td>{{ age(o.created) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- asks -->
      <div class="side">
        <div class="side-header ask-header">
          Asks ({{ data.asks.length }})
          <span class="page-ctrl">
            <button :disabled="askPage === 0" @click="askPage--">‹</button>
            {{ askPage + 1 }} / {{ askPageCount }}
            <button :disabled="askPage >= askPageCount - 1" @click="askPage++">›</button>
          </span>
        </div>
        <table class="table">
          <thead><tr><th>Seller</th><th>Price</th><th>HIVE</th><th>HBD</th><th>Age</th></tr></thead>
          <tbody>
            <tr v-for="o in askPage_entries" :key="o.created + o.seller + o.price">
              <td class="account">{{ o.seller }}</td>
              <td class="ask">{{ fmtPrice(o.price) }}</td>
              <td>{{ o.hive.toFixed(3) }}</td>
              <td>{{ o.hbd.toFixed(3) }}</td>
              <td>{{ age(o.created) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="!data && isFetching" class="loading">Loading order book…</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, LineElement, PointElement,
  LinearScale, Filler, Tooltip, Title,
} from 'chart.js'
import { useOrderBook } from '../composables/useOrderBook'

ChartJS.register(LineElement, PointElement, LinearScale, Filler, Tooltip, Title)

const { data, isFetching } = useOrderBook()

// ── summary ───────────────────────────────────────────────────────────────────

function fmtPrice(price: number | undefined): string {
  if (price == null) return '—'
  return price.toFixed(5)
}

function age(created: string): string {
  const ms = Date.now() - new Date(created + 'Z').getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const spread = computed(() => {
  if (!data.value) return '—'
  const bid = data.value.bids[0]?.price
  const ask = data.value.asks[0]?.price
  if (!bid || !ask) return '—'
  return ((ask - bid) / ask * 100).toFixed(3) + '%'
})

const totalBidHive = computed(() =>
  data.value
    ? data.value.bids.reduce((s, o) => s + o.hive, 0).toFixed(0) + ' HIVE'
    : '—'
)
const totalAskHive = computed(() =>
  data.value
    ? data.value.asks.reduce((s, o) => s + o.hive, 0).toFixed(0) + ' HIVE'
    : '—'
)

// ── depth chart ───────────────────────────────────────────────────────────────

const CLIP_OPTIONS = [10, 20, 30, 50, 0] as const
type ClipPct = typeof CLIP_OPTIONS[number]
const clipPct = ref<ClipPct>(20)

const mid = computed(() => {
  if (!data.value) return 0
  const bid = data.value.bids[0]?.price ?? 0
  const ask = data.value.asks[0]?.price ?? 0
  return (bid + ask) / 2
})

const chartData = computed(() => {
  if (!data.value) return { datasets: [] }

  const m = mid.value
  const pct = clipPct.value
  const lo = pct > 0 ? m * (1 - pct / 100) : 0
  const hi = pct > 0 ? m * (1 + pct / 100) : Infinity

  // bids: sorted highest→lowest; filter, cumulate, reverse for left-side slope
  let cum = 0
  const bidPoints = data.value.bids
    .filter(o => o.price >= lo)
    .map(o => { cum += o.hive; return { x: o.price, y: cum } })
    .reverse()

  // asks: sorted lowest→highest; filter, cumulate for right-side slope
  cum = 0
  const askPoints = data.value.asks
    .filter(o => o.price <= hi)
    .map(o => { cum += o.hive; return { x: o.price, y: cum } })

  return {
    datasets: [
      {
        label: 'Bids',
        data: bidPoints,
        borderColor: 'rgba(0, 160, 80, 1)',
        backgroundColor: 'rgba(0, 160, 80, 0.15)',
        fill: 'origin',
        pointRadius: 0,
        tension: 0,
      },
      {
        label: 'Asks',
        data: askPoints,
        borderColor: 'rgba(220, 30, 30, 1)',
        backgroundColor: 'rgba(220, 30, 30, 0.15)',
        fill: 'origin',
        pointRadius: 0,
        tension: 0,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  parsing: false,
  animation: false,
  plugins: {
    legend: { display: true, position: 'top' as const },
    title: { display: true, text: 'Order Book Depth — HIVE/HBD' },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label: string }; parsed: { x: number; y: number } }) =>
          `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(0)} HIVE @ ${ctx.parsed.x.toFixed(5)}`,
      },
    },
  },
  scales: {
    x: {
      type: 'linear' as const,
      title: { display: true, text: 'Price (HBD per HIVE)' },
      ticks: { maxTicksLimit: 10 },
    },
    y: { title: { display: true, text: 'Cumulative HIVE' } },
  },
}

// ── paginated tables ──────────────────────────────────────────────────────────

const PAGE_SIZE = 25
const bidPage = ref(0)
const askPage = ref(0)

const bidPageCount = computed(() => Math.max(1, Math.ceil((data.value?.bids.length ?? 0) / PAGE_SIZE)))
const askPageCount = computed(() => Math.max(1, Math.ceil((data.value?.asks.length ?? 0) / PAGE_SIZE)))

watch(bidPageCount, count => {
  bidPage.value = Math.min(bidPage.value, count - 1)
})
watch(askPageCount, count => {
  askPage.value = Math.min(askPage.value, count - 1)
})

const bidPage_entries = computed(() =>
  data.value?.bids.slice(bidPage.value * PAGE_SIZE, (bidPage.value + 1) * PAGE_SIZE) ?? []
)
const askPage_entries = computed(() =>
  data.value?.asks.slice(askPage.value * PAGE_SIZE, (askPage.value + 1) * PAGE_SIZE) ?? []
)
</script>

<style scoped>
.summary {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  margin-bottom: 4px;
  font-size: 0.85rem;
}
.stat { display: flex; flex-direction: column; }
.label { font-size: 0.7rem; color: #999; text-transform: uppercase; letter-spacing: 0.05em; }
.value { font-weight: bold; color: #333; }
.value.bid { color: #00a050; }
.value.ask { color: #dc1e1e; }
.fetching { font-size: 0.75rem; color: #aaa; margin-left: auto; }

.chart-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 0.8rem;
}
.chart-label { color: #666; }
.clip-btn {
  padding: 2px 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #f0f0f0;
  cursor: pointer;
  font-size: 0.78rem;
}
.clip-btn.active {
  background: #e2007a;
  color: #fff;
  border-color: #e2007a;
}
.mid-note { margin-left: auto; color: #999; font-size: 0.75rem; }

.caveat {
  font-size: 0.72rem;
  color: #aaa;
  margin: 2px 0 12px;
  font-style: italic;
}

.tables { display: flex; gap: 12px; overflow-x: auto; }
.side { flex: 1; min-width: 320px; }

.side-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  font-size: 0.8rem;
  font-weight: bold;
  border-radius: 4px 4px 0 0;
}
.bid-header { background: rgba(0, 160, 80, 0.1); color: #00a050; }
.ask-header { background: rgba(220, 30, 30, 0.1); color: #dc1e1e; }

.page-ctrl { display: flex; align-items: center; gap: 4px; font-weight: normal; }
.page-ctrl button {
  border: 1px solid #ccc; background: #f5f5f5; border-radius: 3px;
  padding: 1px 6px; cursor: pointer; font-size: 0.85rem;
}
.page-ctrl button:disabled { opacity: 0.35; cursor: default; }

.table { border-collapse: collapse; width: 100%; font-size: 0.78rem; }
.table th, .table td { border: 1px solid #e8e8e8; padding: 3px 7px; text-align: right; }
.table th:first-child, .table td:first-child { text-align: left; }
.table tr:nth-child(even) { background: #fafafa; }
.account { font-family: monospace; font-size: 0.75rem; }
.bid { color: #00a050; font-weight: bold; }
.ask { color: #dc1e1e; font-weight: bold; }

.loading { padding: 40px; text-align: center; color: #aaa; font-size: 0.9rem; }
</style>
