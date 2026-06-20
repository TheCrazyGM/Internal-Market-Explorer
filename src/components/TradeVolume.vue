<template>
  <div>
    <div class="toolbar">
      <span v-if="statusMsg" class="msg">{{ statusMsg }}</span>
      <button class="btn-refresh" @click="$emit('toggleRefresh')">
        {{ autoRefresh ? 'Stop Auto Refresh' : 'Auto Refresh' }}
      </button>
      <div class="donate">
        <a href="https://tools.crypto-dreamr.com/tipjar/open.mithril/5.000/hive/Thank%20you">
          Donate to Open.Mithril
        </a>
      </div>
    </div>

    <div v-if="activeData" style="height:400px; margin-bottom:16px;">
      <Bar :data="chartData" :options="chartOptions" />
    </div>

    <div v-if="activeData">
      <div class="filter-row">
        <b>Filter:</b>
        <input type="text" v-model="filterName" placeholder="Enter name" />
      </div>
      <div class="tables">
        <div class="border">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Trade Volume HBD / HIVE</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="item in activeData.users" :key="item.name">
                <tr v-if="passesFilter(item.name)">
                  <td>{{ item.name }}</td>
                  <td>{{ item.hbd.toFixed(3) + ' / ' + item.hive.toFixed(3) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div class="border">
          <table class="table">
            <thead>
              <tr>
                <th>Time</th><th>Maker</th><th>Taker</th>
                <th>Price</th><th>Hive</th><th>HBD</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="trade in activeData.trades" :key="trade.date + trade.maker">
                <tr v-if="passesFilter(trade.maker) || passesFilter(trade.taker)">
                  <td :title="trade.date">{{ toSimpleDate(trade.date) }}</td>
                  <td>{{ trade.maker }}</td>
                  <td>{{ trade.taker }}</td>
                  <td :class="isHiveSale(trade) ? 'sell' : 'buy'">{{ hivePrice(trade) }}</td>
                  <td>{{ tradeHive(trade) }}</td>
                  <td>{{ tradeHbd(trade) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, Title, Tooltip, Legend,
  BarElement, CategoryScale, LinearScale,
} from 'chart.js'
import { useRecentTrades } from '../composables/useRecentTrades'
import { useTradeHistory } from '../composables/useTradeHistory'
import { HBD_NAI } from '../lib/marketUtils'
import type { DateRange } from '../composables/useTradeHistory'
import type { Trade } from '../types/hive'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps<{
  dateRange: DateRange | null
  autoRefresh: boolean
}>()

defineEmits<{ toggleRefresh: [] }>()

// ── queries (cache-shared across tabs) ───────────────────────────────────────

const autoRefreshRef = computed(() => props.autoRefresh)
const dateRangeRef   = computed(() => props.dateRange)

const recentQuery  = useRecentTrades(autoRefreshRef)
const historyQuery = useTradeHistory(dateRangeRef)

const activeData = computed(() =>
  props.dateRange ? historyQuery.data.value : recentQuery.data.value
)

const isFetching = computed(() =>
  props.dateRange ? historyQuery.isFetching.value : recentQuery.isFetching.value
)

const statusMsg = computed(() => {
  if (isFetching.value) return props.dateRange ? 'Loading trade history…' : 'Loading recent trades…'
  const count = activeData.value?.trades.length
  return count ? `${count} trades loaded` : null
})

// ── local UI state ────────────────────────────────────────────────────────────

const filterName = ref('')

function passesFilter(name: string): boolean {
  const f = filterName.value.trim()
  return f === '' || name.includes(f)
}

// ── trade helpers ─────────────────────────────────────────────────────────────

function isHiveSale(trade: Trade) { return trade.current_pays.nai !== HBD_NAI }

function hivePrice(trade: Trade) {
  const hbdCurrent = trade.current_pays.nai === HBD_NAI
  const hbd  = Number(hbdCurrent ? trade.current_pays.amount : trade.open_pays.amount)
  const hive = Number(hbdCurrent ? trade.open_pays.amount   : trade.current_pays.amount)
  return (hbd / hive).toFixed(5)
}

function tradeHive(trade: Trade) {
  const hbdCurrent = trade.current_pays.nai === HBD_NAI
  return (Number(hbdCurrent ? trade.open_pays.amount : trade.current_pays.amount) * 0.001).toFixed(3)
}

function tradeHbd(trade: Trade) {
  const hbdCurrent = trade.current_pays.nai === HBD_NAI
  return (Number(hbdCurrent ? trade.current_pays.amount : trade.open_pays.amount) * 0.001).toFixed(3)
}

function toSimpleDate(date: string): string {
  const ti0 = new Date(date + 'Z').getTime()
  const ti  = Date.now()
  if (ti0 <= ti) {
    let d = ti - ti0
    const hours = Math.floor(d / 3_600_000)
    if (hours <= 24) {
      d -= 3_600_000 * hours
      const minutes = Math.floor(d / 60_000)
      d -= 60_000 * minutes
      const seconds = Math.floor(d / 1_000)
      const h = hours   === 0 ? '    ' : hours   < 10 ? ` ${hours}h `   : `${hours}h `
      const m = (hours && minutes === 0) ? '    ' : minutes < 10 ? ` ${minutes}m ` : `${minutes}m `
      const s = seconds < 10 ? ` ${seconds}s ` : `${seconds}s `
      return h + m + s
    }
    d /= 1_000; if (d <= 60) return d.toFixed(0) + 's'
    d /= 60;    if (d <= 60) return d.toFixed(0) + 'm'
    d /= 60;    if (d <= 24) return d.toFixed(0) + 'h'
  }
  return date
}

// ── chart ─────────────────────────────────────────────────────────────────────

const TOP_N = 30

const chartData = computed(() => {
  const users = activeData.value?.users.slice(0, TOP_N) ?? []
  return {
    labels: users.map(u => u.name),
    datasets: [{
      label: 'HBD Volume',
      data: users.map(u => u.hbd),
      backgroundColor: 'rgba(226, 0, 122, 0.75)',
      borderColor: 'rgba(226, 0, 122, 1)',
      borderWidth: 1,
    }],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: true, text: 'Top Traders by HBD Volume' },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number } }) => ` ${ctx.parsed.y.toFixed(2)} HBD`,
      },
    },
  },
  scales: {
    x: { ticks: { maxRotation: 45, minRotation: 30 } },
    y: { title: { display: true, text: 'HBD' } },
  },
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.msg { font-size: 0.8rem; opacity: 0.6; }
.btn-refresh {
  padding: 4px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f0f0f0;
  cursor: pointer;
  font-size: 0.8rem;
}
.donate a {
  font-size: 0.8rem;
  color: #e2007a;
  text-decoration: none;
}
.donate a:hover { text-decoration: underline; }
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 0.875rem;
}
.filter-row input {
  padding: 3px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.875rem;
}
.tables { display: flex; gap: 8px; overflow-x: auto; }
.border { border: 1px solid #dadada; }
.table { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
.table th, .table td { border: 1px solid #dadada; padding: 4px 7px; text-align: left; }
.table tr:nth-child(even) { background: #f9f9f9; }
.sell { color: red; }
.buy  { color: green; }
</style>
