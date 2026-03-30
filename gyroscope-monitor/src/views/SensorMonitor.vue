<template>
  <a-layout style="min-height: 100vh">
    <a-layout-header style="color: #fff; font-size: 20px">
      📡 传感器数据实时监控
      <a-tag :color="connected ? 'green' : 'red'" style="margin-left: 16px">
        {{ connected ? '已连接' : '未连接' }}
      </a-tag>
    </a-layout-header>

    <a-layout-content style="padding: 24px">
      <a-row :gutter="16" style="margin-bottom: 24px">
        <a-col v-for="schema in cardSchemas" :key="schema.key" :span="6">
          <a-card :title="cardTitle(schema)" :bordered="false">
            <a-descriptions :column="1" size="small">
              <a-descriptions-item
                v-for="field in schema.fields"
                :key="`${schema.key}-${field.key}`"
                :label="field.label"
              >
                <a-tag :color="fieldTagColor(field, latestData.sensors[schema.key]?.[field.key])">
                  {{ formatFieldValue(field, latestData.sensors[schema.key]?.[field.key]) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="能力">
                <a-tag :color="capabilityTagColor(sensorCapabilities[schema.key]?.capability)">
                  {{ formatCapabilityState(sensorCapabilities[schema.key]?.capability) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="状态">
                <a-tag :color="runtimeStatusTagColor(sensorStatuses[schema.key]?.state)">
                  {{ formatRuntimeStatus(sensorStatuses[schema.key]?.state) }}
                </a-tag>
                <span v-if="sensorStatuses[schema.key]?.detail" style="margin-left: 8px; color: #999;">
                  {{ sensorStatuses[schema.key].detail }}
                </span>
              </a-descriptions-item>
            </a-descriptions>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col v-for="schema in chartSchemas" :key="`${schema.key}-chart`" :span="8">
          <a-card :title="`${schema.label}实时曲线`" :bordered="false">
            <v-chart :option="chartOption(schema)" autoresize style="height: 300px" />
          </a-card>
        </a-col>
      </a-row>

      <a-card title="📋 最近数据记录" style="margin-top: 24px" :bordered="false">
        <a-table
          :dataSource="historyData"
          :columns="columns"
          :pagination="{ pageSize: 10 }"
          size="small"
          :scroll="{ x: 1600 }"
          rowKey="timestamp"
        />
      </a-card>
    </a-layout-content>
  </a-layout>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, DataZoomComponent
} from 'echarts/components'
import { sensorSchemas } from '../schemas/sensorRegistry.js'
import {
  capabilityTagColor,
  formatCapabilityState,
  formatFieldValue,
  formatRuntimeStatus,
  runtimeStatusTagColor,
  toChartValue
} from '../utils/formatters.js'
import {
  createEmptyCapabilityState,
  createEmptySensors,
  createEmptySeriesState,
  createEmptyStatusState,
  normalizeCapabilityMessage,
  normalizeStatusMessage,
  normalizeTelemetryMessage
} from '../utils/normalizers.js'

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent,
  LegendComponent, GridComponent, DataZoomComponent])

const MAX_POINTS = 200
const MAX_HISTORY = 500

const connected = ref(false)
const latestData = ref({
  deviceId: 'unknown-device',
  timestamp: null,
  sensors: createEmptySensors(sensorSchemas)
})
const sensorCapabilities = ref(createEmptyCapabilityState(sensorSchemas))
const sensorStatuses = ref(createEmptyStatusState(sensorSchemas))
const historyData = ref([])
const timeLabels = ref([])
const chartSeriesState = reactive(createEmptySeriesState(sensorSchemas))

let ws = null
let reconnectTimer = null

const cardSchemas = sensorSchemas.filter((schema) => schema.widgets.includes('card'))
const chartSchemas = sensorSchemas.filter((schema) => schema.widgets.includes('chart'))

const columns = computed(() => {
  const baseColumns = [
    { title: '时间', dataIndex: 'time', width: 180 },
    { title: '设备ID', dataIndex: 'deviceId', width: 140 }
  ]

  const schemaColumns = sensorSchemas
    .filter((schema) => schema.widgets.includes('table'))
    .flatMap((schema) => schema.fields.map((field) => ({
      title: field.tableTitle || `${schema.label} ${field.label}`,
      dataIndex: `${schema.key}_${field.key}`,
      width: field.type === 'enum' ? 140 : 120
    })))

  return [...baseColumns, ...schemaColumns]
})

function cardTitle(schema) {
  return `${schema.icon} ${schema.label}${schema.unit ? ` (${schema.unit})` : ''}`
}

function fieldTagColor(field, value) {
  if (field.key === 'source') {
    return value ? 'green' : 'default'
  }
  return field.color || 'blue'
}

function buildChartOption(schema) {
  const chartFields = schema.fields.filter((field) => field.chart)
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: chartFields.map((field) => field.label) },
    xAxis: { type: 'category', data: timeLabels.value, boundaryGap: false },
    yAxis: { type: 'value' },
    series: chartFields.map((field) => ({
      name: field.label,
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: chartSeriesState[schema.key][field.key]
    }))
  }
}

function chartOption(schema) {
  return buildChartOption(schema)
}

function trimSeriesAndLabels() {
  if (timeLabels.value.length <= MAX_POINTS) {
    return
  }

  timeLabels.value.shift()
  chartSchemas.forEach((schema) => {
    schema.fields
      .filter((field) => field.chart)
      .forEach((field) => {
        chartSeriesState[schema.key][field.key].shift()
      })
  })
}

function buildHistoryRow(normalized) {
  const row = {
    time: new Date(normalized.timestamp).toLocaleTimeString(),
    deviceId: normalized.deviceId,
    timestamp: normalized.timestamp
  }

  sensorSchemas
    .filter((schema) => schema.widgets.includes('table'))
    .forEach((schema) => {
      schema.fields.forEach((field) => {
        row[`${schema.key}_${field.key}`] = formatFieldValue(field, normalized.sensors[schema.key]?.[field.key])
      })
    })

  return row
}

function appendTelemetry(normalized) {
  latestData.value = normalized
  sensorStatuses.value = {
    ...sensorStatuses.value,
    ...normalized.sensorStatuses
  }

  timeLabels.value.push(new Date(normalized.timestamp).toLocaleTimeString())
  chartSchemas.forEach((schema) => {
    schema.fields
      .filter((field) => field.chart)
      .forEach((field) => {
        chartSeriesState[schema.key][field.key].push(
          toChartValue(field, normalized.sensors[schema.key]?.[field.key])
        )
      })
  })
  trimSeriesAndLabels()

  historyData.value.unshift(buildHistoryRow(normalized))
  if (historyData.value.length > MAX_HISTORY) {
    historyData.value.pop()
  }
}

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
      const msgType = data.msgType || data.type || 'telemetry'
      if (msgType === 'heartbeat') {
        return
      }

      if (msgType === 'capability') {
        sensorCapabilities.value = normalizeCapabilityMessage(data, sensorSchemas)
        return
      }

      if (msgType === 'status') {
        sensorStatuses.value = normalizeStatusMessage(data, sensorSchemas)
        return
      }

      const normalized = normalizeTelemetryMessage(data, sensorSchemas)
      appendTelemetry(normalized)
    } catch (e) {
      console.error('数据解析失败:', e)
    }
  }

  ws.onclose = () => {
    connected.value = false
    console.log('WebSocket 已断开，3秒后重连...')
    reconnectTimer = window.setTimeout(connectWebSocket, 3000)
  }

  ws.onerror = (err) => {
    console.error('WebSocket 错误:', err)
  }
}

onMounted(() => connectWebSocket())
onUnmounted(() => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  ws?.close()
})
</script>
