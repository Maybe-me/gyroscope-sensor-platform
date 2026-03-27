<template>
  <a-layout style="min-height: 100vh">
    <a-layout-header style="color: #fff; font-size: 20px">
      📡 陀螺仪数据实时监控
      <a-tag :color="connected ? 'green' : 'red'" style="margin-left: 16px">
        {{ connected ? '已连接' : '未连接' }}
      </a-tag>
    </a-layout-header>

    <a-layout-content style="padding: 24px">
      <a-row :gutter="16" style="margin-bottom: 24px">
        <a-col :span="8">
          <a-card title="🔄 陀螺仪 (rad/s)" :bordered="false">
            <a-descriptions :column="1" size="small">
              <a-descriptions-item label="X">
                <a-tag color="blue">{{ latestData.gyroscope?.x?.toFixed(4) ?? '--' }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="Y">
                <a-tag color="green">{{ latestData.gyroscope?.y?.toFixed(4) ?? '--' }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="Z">
                <a-tag color="orange">{{ latestData.gyroscope?.z?.toFixed(4) ?? '--' }}</a-tag>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>
        </a-col>

        <a-col :span="8">
          <a-card title="📐 加速度计 (m/s²)" :bordered="false">
            <a-descriptions :column="1" size="small">
              <a-descriptions-item label="X">
                <a-tag color="blue">{{ latestData.accelerometer?.x?.toFixed(4) ?? '--' }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="Y">
                <a-tag color="green">{{ latestData.accelerometer?.y?.toFixed(4) ?? '--' }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="Z">
                <a-tag color="orange">{{ latestData.accelerometer?.z?.toFixed(4) ?? '--' }}</a-tag>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>
        </a-col>

        <a-col :span="8">
          <a-card title="🧭 设备姿态 (°)" :bordered="false">
            <a-descriptions :column="1" size="small">
              <a-descriptions-item label="Alpha (Z轴)">
                <a-tag color="blue">{{ latestData.orientation?.alpha?.toFixed(2) ?? '--' }}°</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="Beta (X轴)">
                <a-tag color="green">{{ latestData.orientation?.beta?.toFixed(2) ?? '--' }}°</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="Gamma (Y轴)">
                <a-tag color="orange">{{ latestData.orientation?.gamma?.toFixed(2) ?? '--' }}°</a-tag>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-card title="陀螺仪实时曲线" :bordered="false">
            <v-chart :option="gyroChartOption" autoresize style="height: 300px" />
          </a-card>
        </a-col>
        <a-col :span="12">
          <a-card title="加速度计实时曲线" :bordered="false">
            <v-chart :option="accelChartOption" autoresize style="height: 300px" />
          </a-card>
        </a-col>
      </a-row>

      <a-card title="📋 最近数据记录" style="margin-top: 24px" :bordered="false">
        <a-table
          :dataSource="historyData"
          :columns="columns"
          :pagination="{ pageSize: 10 }"
          size="small"
          :scroll="{ x: 1200 }"
          rowKey="timestamp"
        />
      </a-card>
    </a-layout-content>
  </a-layout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, DataZoomComponent
} from 'echarts/components'

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent,
     LegendComponent, GridComponent, DataZoomComponent])

const MAX_POINTS = 200

const connected = ref(false)
const latestData = ref({})
const historyData = ref([])

const timeLabels = ref([])
const gyroX = ref([]), gyroY = ref([]), gyroZ = ref([])
const accelX = ref([]), accelY = ref([]), accelZ = ref([])

let ws = null

const columns = [
  { title: '时间', dataIndex: 'time', width: 180 },
  { title: '设备ID', dataIndex: 'deviceId', width: 120 },
  { title: '陀螺仪 X', dataIndex: 'gx', width: 100 },
  { title: '陀螺仪 Y', dataIndex: 'gy', width: 100 },
  { title: '陀螺仪 Z', dataIndex: 'gz', width: 100 },
  { title: '加速度 X', dataIndex: 'ax', width: 100 },
  { title: '加速度 Y', dataIndex: 'ay', width: 100 },
  { title: '加速度 Z', dataIndex: 'az', width: 100 },
]

function buildChartOption(title, xData, series) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['X', 'Y', 'Z'] },
    xAxis: { type: 'category', data: xData.value, boundaryGap: false },
    yAxis: { type: 'value' },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: s.data.value
    }))
  }
}

const gyroChartOption = computed(() =>
  buildChartOption('陀螺仪', timeLabels,
    [{ name: 'X', data: gyroX }, { name: 'Y', data: gyroY }, { name: 'Z', data: gyroZ }])
)

const accelChartOption = computed(() =>
  buildChartOption('加速度计', timeLabels,
    [{ name: 'X', data: accelX }, { name: 'Y', data: accelY }, { name: 'Z', data: accelZ }])
)

function connectWebSocket() {
  const wsUrl = window.location.protocol === 'https:'
    ? `wss://${window.location.host}/ws/monitor`
    : `ws://${window.location.hostname}:8080/ws/monitor`

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    connected.value = true
    console.log('WebSocket 已连接')
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      latestData.value = data

      const time = new Date(data.timestamp).toLocaleTimeString()
      timeLabels.value.push(time)
      gyroX.value.push(data.gyroscope?.x ?? 0)
      gyroY.value.push(data.gyroscope?.y ?? 0)
      gyroZ.value.push(data.gyroscope?.z ?? 0)
      accelX.value.push(data.accelerometer?.x ?? 0)
      accelY.value.push(data.accelerometer?.y ?? 0)
      accelZ.value.push(data.accelerometer?.z ?? 0)

      if (timeLabels.value.length > MAX_POINTS) {
        timeLabels.value.shift()
        gyroX.value.shift(); gyroY.value.shift(); gyroZ.value.shift()
        accelX.value.shift(); accelY.value.shift(); accelZ.value.shift()
      }

      historyData.value.unshift({
        time,
        deviceId: data.deviceId,
        gx: data.gyroscope?.x?.toFixed(4),
        gy: data.gyroscope?.y?.toFixed(4),
        gz: data.gyroscope?.z?.toFixed(4),
        ax: data.accelerometer?.x?.toFixed(4),
        ay: data.accelerometer?.y?.toFixed(4),
        az: data.accelerometer?.z?.toFixed(4),
        timestamp: data.timestamp
      })

      if (historyData.value.length > 500) {
        historyData.value.pop()
      }
    } catch (e) {
      console.error('数据解析失败:', e)
    }
  }

  ws.onclose = () => {
    connected.value = false
    console.log('WebSocket 已断开，3秒后重连...')
    setTimeout(connectWebSocket, 3000)
  }

  ws.onerror = (err) => {
    console.error('WebSocket 错误:', err)
  }
}

onMounted(() => connectWebSocket())
onUnmounted(() => ws?.close())
</script>
