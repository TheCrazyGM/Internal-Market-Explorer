<template>
  <div class="main">
    <div class="title">
        <div><h3 class="h3">Hive Trade Feed</h3></div>
        <div class="flex">
            <div v-if="msg" class="msg">{{msg}}</div>
            <div v-if="showLoadButton" title="Loading all users will take few mintues." class="donate" @click="toggleTimer()">
                {{running?'Stop Auto Refresh':'Auto Refresh'}}
            </div>
            <div class="donate">
              <a href="https://thecrazygm.com/hivetools/utility/tipjar/open.mithril/5/hbd/thank%20you">
              Donate to Open.Mithril</a>
            </div>
        </div>
    </div>
    <div class="flex">
        <div><label>Timestamp (from - to)</label></div>
        <div>
            <div><input type="text" v-model="loadFrom" style="margin-right:15px;"/></div>
            <div class="flex">
                <button @click="loadFrom='7d'">7d</button>
                <button @click="loadFrom='5d'">5d</button>
                <button @click="loadFrom='3d'">3d</button>
                <button @click="loadFrom='2d'">2d</button>
                <button @click="loadFrom='1d'">1d</button>
            </div>
        </div>
        <div>
            <div><input type="text" v-model="loadTo"/></div>
            <div>
        
            </div>
        </div>
        <div>
            <div title="Load" class="donate" @click="init0()">Load</div>
        </div>
        <div class="gray">eg.: "3d", "15h", "2025-04-28T12:10:15"</div>
     </div>
    <div ref="chartRef0" style="height:1100px;"></div>
    <div v-if="sortedArray">
        <div style="margin:3px;"><b>Filter:</b> <input type="text" v-model="filterName" style="margin-right:15px;" placeholder="Enter name"/></div>
        <div class="flex">   
            <div class="border">
                <table class="table">
                <thead>
                    <tr>
                    <th rowspan="2">Name</th> <th>Trade Volume HBD/HIVE</th>
                    </tr>
                </thead>
                <tbody>
                <template v-for="item in sortedArray">
                    <tr v-if="passesFilter(item.name,filterName)"> 
                        <td>{{item.name}}</td> <td>{{item.hbd.toFixed(3)+' / '+item.hive.toFixed(3)}}</td>
                    </tr>
                </template>
                </tbody>
                </table>
            </div>
            <div class="border">
                <table class="table">
                <thead>
                    <tr>
                    <th>Time</th> <th>Maker</th> <th>Taker</th> <th>Price</th> <th>Hive</th> <th>HBD</th>
                    </tr>
                </thead>
                <tbody>
                <template v-for="trade in sortedTrades">
                    <tr v-if="passesFilter(trade.maker,filterName)||passesFilter(trade.taker,filterName)"> 
                        <td :title="trade.date">{{toSimpleDate(trade.date)}}</td>
                        <td>{{trade.maker}}</td> 
                        <td>{{trade.taker}}</td> 
                        <td :class="isHiveSale(trade)?'tradeSell':'tradeBuy'"> {{hivePrice(trade)}}</td>
                        <td>{{tradeHive(trade)}}</td>
                        <td>{{tradeHbd(trade)}}</td>
                    </tr>
                </template>
                </tbody>
                </table>
            </div>
        </div>
    </div>
    
  <div>

</template>

<script setup>
import { ref, useTemplateRef, computed, onMounted } from 'vue';
//import { wget } from '../../js/utils.mjs';
const { AgCharts } = agCharts;

const loadFrom = ref("");
const loadTo = ref("");

function passesFilter(name, filter) {
    if(filter == null) return true;
    filter = filter.trim();
    return name.indexOf(filter) !== -1;
}

var chartRef = useTemplateRef("chartRef0");
var msg = ref(null);
var sortedArray = ref(null);
var sortedTrades = ref(null);
var showLoadButton = ref(true);
var filterName = ref("");

function isHiveSale(item) {
    var hbdCurrent = item.current_pays.nai === "@@000000013";
    return !hbdCurrent;
}
function hivePrice(item) {
    var hbdCurrent = item.current_pays.nai === "@@000000013";
    return (Number(hbdCurrent?item.current_pays.amount:item.open_pays.amount)/
            Number(hbdCurrent?item.open_pays.amount:item.current_pays.amount)).toFixed(5);
} 
function tradeHive(item) {
    var hbdCurrent = item.current_pays.nai === "@@000000013";
    return (Number(hbdCurrent?item.open_pays.amount:item.current_pays.amount)*0.001).toFixed(3);
}
function tradeHbd(item) {
    var hbdCurrent = item.current_pays.nai === "@@000000013";
    return (Number(hbdCurrent?item.current_pays.amount:item.open_pays.amount)*0.001).toFixed(3);
}
function toSimpleDate(date) {
    var ti0 = new Date(date+'Z').getTime();
    var ti = new Date().getTime();
    if(ti0 <= ti) {
        var d = ti-ti0;
        var hours = Math.floor(d/3600000);
        if(hours <= 24) {
            d -= 3600000*hours;
            var minutes = Math.floor(d/60000);
            d -= 60000*minutes;
            var seconds = Math.floor(d/1000);
            var text = '';
            if(hours === 0) text += '    ';
            else if(hours < 10) text += ' '+hours+'h ';
            else text += hours+'h ';
            
            if(hours && minutes === 0) text += '    ';
            else if(minutes < 10) text += ' '+minutes+'m ';
            else text += minutes+'m ';

            if(seconds < 10) text += ' '+seconds+'s ';
            else text += seconds+'s ';

            return text;
        }

        d /= 1000;
        if(d <= 60) return d.toFixed(0) + 's';
        d /= 60;
        if(d <= 60) return d.toFixed(0) + 'm';
        d /= 60;
        if(d <= 24) return d.toFixed(0) + 'h';
    }
    return date;
}
function toTime(t) {
    if(typeof t === "number") return t;
    if(typeof t === "string") {
        if(t.toLowerCase().endsWith('m'))
            return new Date().getTime()-60*1000*Number(t.substring(0,t.length-1));
        if(t.toLowerCase().endsWith('h'))
            return new Date().getTime()-60*60*1000*Number(t.substring(0,t.length-1));
        if(t.toLowerCase().endsWith('d'))
            return new Date().getTime()-24*60*60*1000*Number(t.substring(0,t.length-1));
        return new Date(t+'Z').getTime();
    }
    return t.getTime();
}

async function proposalsStatsAPI() {
    //var url = "https://stats.hivehub.dev/dhf_proposals";
    //var data = await wget(url);
    return [];
}

async function delay(ms) {
    if(ms <= 0) return Promise.resolve(true);       
    return new Promise(r=>{setTimeout(r, ms);});
}
function formatDate(timestamp) {
    return new Date(timestamp).toISOString().substring(0,19);
}
var tradeHistory = [];
async function loadRecentTrades() {
    msg.value = "Loading recent hive trade history ";
    
    var users = {};
    var errors = 0;
    while(true) {
        try {
            tradeHistory = [];  
            var history = await hive.api.callAsync("market_history_api.get_recent_trades", { limit: 1000 });
            if(history.trades === undefined) return users;
            history = history.trades;
            for(var item of history) {
                var hbdCurrent = item.current_pays.nai === "@@000000013";
                var hbd = Number(hbdCurrent?item.current_pays.amount:item.open_pays.amount)*0.001;
                var hi = Number(hbdCurrent?item.open_pays.amount:item.current_pays.amount)*0.001;
                var userM = users[item.maker];
                if(userM === undefined) users[item.maker] = userM = [0, 0];
                var userT = users[item.taker];
                if(userT === undefined) users[item.taker] = userT = [0, 0];
                userM[0] += hi;  userM[1] += hbd;
                userT[0] += hi;  userT[1] += hbd;
                tradeHistory.push(item)
            }           
            return users;
        }
        catch(e) {
            console.log(e);
            await delay(1000);
            if(errors++ > 7) {
                console.log("Failed to load recent trades");
                return users;
            }
        } 
    }
}
async function loadTrades(startTi, endTi=null) {
    msg.value = "Loading hive trade history ";

    var endTiFormat = endTi===null?null:formatDate(endTi);
    
    var errors = 0;
    var users = {};
    tradeHistory = [];
    while(true) {
        try {
            var query = { limit: 1000, start: formatDate(startTi) };
            if(endTiFormat !== null) query.end = endTiFormat;
            var history = await hive.api.callAsync("market_history_api.get_trade_history", query);
            
            if(history.trades === undefined) return users;
            history = history.trades;
            console.log(history);
            if(history.length == 0) {
                return users;
            }
            else {
                msg.value += ".";
                for(var item of history) {
                    var hbdCurrent = item.current_pays.nai === "@@000000013";
                    var hbd = Number(hbdCurrent?item.current_pays.amount:item.open_pays.amount)*0.001;
                    var hi = Number(hbdCurrent?item.open_pays.amount:item.current_pays.amount)*0.001;
                    var userM = users[item.maker];
                    if(userM === undefined) users[item.maker] = userM = [0, 0];
                    var userT = users[item.taker];
                    if(userT === undefined) users[item.taker] = userT = [0, 0];
                    userM[0] += hi;  userM[1] += hbd;
                    userT[0] += hi;  userT[1] += hbd;
                    startTi = Math.max(startTi, new Date(item.date+"Z").getTime());
                    tradeHistory.push(item)
                }
                startTi++;
                console.log(history);
                if(history.length < 1000 || startTi >= endTi) {
                   return users;
                }
                await delay(250);
            }
        }
        catch(e) {
            console.log(e);
            await delay(1000);
            if(errors++ > 7) {
                console.log("Failed to load trades");
                return users;
            }
        }
    }
}

function toDouble(n,d=0) {
    if(n === undefined) return d;
    if(typeof n === 'number') return n;
    var r = n.trim();
    var i = n.indexOf(' ');
    if(i == -1) return Number(r);
    return Number(r.substring(0, i));
}

async function init0() {
    //var startTi = new Date("2025-01-02T00:00:00").getTime();
    //var endTi = new Date("2025-01-03T00:00:00").getTime();
    var strFrom = loadFrom.value.trim();
    var strTo = loadTo.value.trim();
    if(strFrom.length === 0) return;
    var startTi = toTime(strFrom);
    var endTi = (strTo.length === 0)?(new Date().getTime()+24*60*60*1000):toTime(strTo);

    var trades = await loadTrades(startTi, endTi);
    
    msg.value = "Generating chart ...";
    var users = [];
    for(var name in trades) {
        var hihbd = trades[name];
        users.push({name, hive: hihbd[0], hbd:hihbd[1]});
    }
   
    users.sort((a,b)=>b.hbd-a.hbd);
    sortedTrades.value = tradeHistory;
    sortedArray.value = users;
    
    msg.value = null;

    console.log("sorted", users);
}

async function init() {
    var trades = await loadRecentTrades();

    msg.value = "Generating chart ...";
    var users = [];
    for(var name in trades) {
        var hihbd = trades[name];
        users.push({name, hive: hihbd[0], hbd:hihbd[1]});
    }
   
    users.sort((a,b)=>b.hbd-a.hbd);
    sortedTrades.value = tradeHistory;
    sortedArray.value = users;
    
    msg.value = "Loaded " + tradeHistory.length + " trades ";

    console.log("sorted", users);

    if(running.value) setTimeout(init, 5000);
}
//var promise = init0();
var promise = init();
const running = ref(false);
function toggleTimer() {
    running.value = !running.value;
    if(running.value) setTimeout(init, 5000);
}

async function loadAll() {
    try {
        showLoadButton.value = false;
        await init0();
        createChart();
    }
    catch(e) {
        console.log(e);
    }
}

function getData() {
  return sortedArray.value;
}

function createChart() {
    if(chartRef.value) {
        chartRef.value.innerHTML = "";
        const options = {
          container: chartRef.value,
          data: getData(),
          title: {
            text: "Hive Trade Volume",
          },
          series: [
            {
              type: "pie",
              angleKey: "hbd",
              calloutLabelKey: "name",
              sectorLabelKey: "hbd",
              sectorLabel: {
                color: "white",
                fontWeight: "bold",
                formatter: ({ value }) => {
                    if(value > 1000000) return `${(Math.floor(value / 1000000)).toFixed(0)}M`
                    return `${(value / 1000).toFixed(0)}K`
                }
              },
            },
          ],
        };
        AgCharts.create(options);
    }
}

onMounted(async ()=>{
    try {
        if(chartRef.value) {
            await promise; 
            createChart();
        }
    }
    catch(e) {
        console.log(e);    
    }
});

</script>

<style scoped>
.flex {
    display: flex;
    gap: 5px;
}
.h3 {
    margin: 5px;
}
.border { border: 1px solid #dadada; }
.tradeSell { color: red; }
.tradeBuy { color: green; }
.main {
    padding: 10px;
    border: 1px solid #dadada;
    margin:20px;
    max-width:950px;
    width: 950px;
    background-color: #f9f9f9;
    margin-bottom: 450px;
}
.table {
    overflow-x: auto;
    max-width: 100%;
}
.table thead {
    font-size: 0.875rem;
    line-height: 1.25rem;
}
.table tbody {
    font-size: 0.875rem;
    line-height: 1.25rem;
}
.table {
    border: 1px solid var(--uapp-border);
    border-collapse: collapse;
    width: 100%;
}
.table th, .table td {
    border: 1px solid var(--uapp-border);
    padding: 5px 7px;
    text-align: left;
}
.table tr {
    background-color: var(--uapp-bgtablerow1);
}
.table tr:nth-child(even) {
    background-color: var(--uapp-bgtablerow2);
}
.title {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
}
.donate {
    font-size: 0.875rem;
    text-align: center;
    background-color: var(--appbgbtn1);
    color: var(--appfgbtn1);
    cursor: pointer;
    transition: background-color 0.3s ease;
    font-weight: bold;
    padding: 5px 7px;
    border: 1px solid #ddd;
    border-radius: 5px;
}
.donate:hover {
  background-color: var(--apphgbtn1);
}
.donate > a {
    display: inline-block;
    padding-top: 1px;
    color: var(--appfgbtn1);
    text-decoration: none;
}
.msg {
    padding: 5px;
    opacity: 0.5;
    font-size: small;
}
</style>

