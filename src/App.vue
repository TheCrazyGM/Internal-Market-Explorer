<template>
  <div class="app">
    <header class="app-header">
      <h2 class="app-title">Hive Internal Market Explorer</h2>

      <div class="date-controls">
        <label>Range (from – to)</label>
        <div class="date-inputs">
          <input type="text" v-model="loadFrom" placeholder="e.g. 1d, 6h, 2025-04-28T12:00:00" />
          <span>→</span>
          <input type="text" v-model="loadTo" placeholder="now" />
        </div>
        <div class="quick-btns">
          <button v-for="d in ['7d','5d','3d','2d','1d','12h','6h','1h']" :key="d" @click="loadFrom = d; loadTo = ''">{{ d }}</button>
        </div>
        <button class="btn-load" @click="submitDateRange">Load</button>
        <button class="btn-recent" @click="clearDateRange">Recent trades</button>
        <span v-if="dateError" class="date-error">{{ dateError }}</span>
      </div>

      <nav class="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
    </header>

    <main class="app-main">
      <TradeVolume
        v-if="activeTab === 'volume'"
        :date-range="dateRange"
        :auto-refresh="autoRefresh"
        @toggle-refresh="autoRefresh = !autoRefresh"
      />
      <OrderBook v-else-if="activeTab === 'orderbook'" />
      <ProfitTracker v-else-if="activeTab === 'profit'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import TradeVolume from './components/TradeVolume.vue'
import OrderBook from './components/OrderBook.vue'
import ProfitTracker from './components/ProfitTracker.vue'
import { toTime } from './lib/marketUtils'
import type { DateRange } from './composables/useTradeHistory'

const tabs = [
  { id: 'volume',     label: 'Trade Volume' },
  { id: 'orderbook',  label: 'Order Book' },
  { id: 'profit',     label: 'Profit Tracker' },
] as const

type TabId = typeof tabs[number]['id']

const activeTab = ref<TabId>('volume')

// shared date-range state — lifted here so tab switches don't reset it
const loadFrom   = ref('')
const loadTo     = ref('')
const dateRange  = ref<DateRange | null>(null)
const autoRefresh = ref(false)
const dateError = ref('')

function submitDateRange() {
  const strFrom = loadFrom.value.trim()
  if (!strFrom) return
  const strTo = loadTo.value.trim()

  const parseTime = (value: string) => value.toLowerCase() === 'now' ? Date.now() : toTime(value)
  const from = parseTime(strFrom)
  const to = strTo ? parseTime(strTo) : Date.now()

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    dateError.value = 'Enter a valid date or relative time such as 1d, 6h, or now.'
    return
  }
  if (from > to) {
    dateError.value = 'The start of the range must be before the end.'
    return
  }

  dateError.value = ''
  dateRange.value = { from, to }
}

function clearDateRange() {
  loadFrom.value = ''
  loadTo.value   = ''
  dateRange.value = null
  dateError.value = ''
}
</script>

<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #f4f4f4; }
</style>

<style scoped>
.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}

.app-header {
  background: #fff;
  border: 1px solid #dadada;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.app-title {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.date-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.85rem;
}

.date-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.date-inputs input {
  width: 200px;
  padding: 4px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
}

.quick-btns {
  display: flex;
  gap: 4px;
}

.quick-btns button,
.btn-load,
.btn-recent {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f0f0f0;
  cursor: pointer;
  font-size: 0.8rem;
}

.btn-load {
  background: #e2007a;
  color: #fff;
  border-color: #e2007a;
  font-weight: bold;
}

.btn-load:hover    { background: #c0006a; }
.btn-recent:hover  { background: #e0e0e0; }
.date-error { color: #b71c1c; font-size: 0.78rem; }

.tab-nav {
  display: flex;
  gap: 4px;
  border-top: 1px solid #eee;
  padding-top: 10px;
}

.tab-btn {
  padding: 6px 16px;
  border: 1px solid #ccc;
  border-radius: 4px 4px 0 0;
  background: #f0f0f0;
  cursor: pointer;
  font-size: 0.875rem;
  color: #555;
  transition: background 0.15s;
}

.tab-btn.active {
  background: #fff;
  border-bottom-color: #fff;
  color: #e2007a;
  font-weight: bold;
}

.tab-btn:hover:not(.active) { background: #e8e8e8; }

.app-main {
  background: #fff;
  border: 1px solid #dadada;
  border-radius: 0 8px 8px 8px;
  padding: 16px;
  min-height: 400px;
}
</style>
