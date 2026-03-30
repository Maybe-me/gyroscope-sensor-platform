<template>
  <view class="container">
    <!-- 顶部状态栏 -->
    <view class="status-bar" :class="connected ? 'status-connected' : 'status-disconnected'">
      <view class="status-dot"></view>
      <text class="status-text">{{ connected ? '已连接' : '未连接' }}</text>
    </view>

    <!-- 服务器配置 -->
    <view class="card">
      <view class="card-title">服务器配置</view>
      <view class="input-row">
        <text class="input-label">地址：</text>
        <input
          class="input-field"
          v-model="serverUrl"
          placeholder="ws://192.168.1.100:8080/ws/sensor"
          :disabled="collecting"
        />
      </view>
    </view>

    <!-- 采集频率 -->
    <view class="card">
      <view class="card-title">采集频率</view>
      <view class="freq-row">
        <view
          v-for="item in freqOptions"
          :key="item.value"
          class="freq-btn"
          :class="frequency === item.value ? 'freq-btn-active' : ''"
          @click="!collecting && setFrequency(item.value)"
        >
          <text class="freq-label">{{ item.label }}</text>
          <text class="freq-hz">{{ item.hz }}</text>
        </view>
      </view>
    </view>

    <!-- 控制按钮 -->
    <view class="btn-row">
      <button
        class="ctrl-btn"
        :class="collecting ? 'btn-stop' : 'btn-start'"
        @click="toggleCollect"
      >
        {{ collecting ? '停止采集' : '开始采集' }}
      </button>
    </view>

    <view class="card">
      <view class="card-title">传感器状态</view>
      <view class="sensor-status-list">
        <view class="sensor-status-item" v-for="item in sensorStatusList" :key="item.key">
          <view class="sensor-status-main">
            <text class="sensor-status-label">{{ item.label }}</text>
            <text class="sensor-status-detail">{{ item.detail }}</text>
          </view>
          <text class="sensor-status-badge" :class="sensorStatusClass(item.state)">
            {{ sensorStatusText(item.state) }}
          </text>
        </view>
      </view>
    </view>

    <!-- 实时数据展示 -->
    <view class="card">
      <view class="card-title">实时传感器数据</view>

      <!-- 陀螺仪 -->
      <view class="sensor-group">
        <text class="sensor-group-title">陀螺仪（rad/s）</text>
        <view class="sensor-values">
          <view class="sensor-item" v-for="axis in ['x','y','z']" :key="'g'+axis">
            <text class="axis-label">{{ axis.toUpperCase() }}</text>
            <view class="bar-track">
              <view class="bar-fill" :style="{ width: barWidth(gyroscope[axis]) + '%' }"></view>
            </view>
            <text class="axis-value">{{ fmt(gyroscope[axis]) }}</text>
          </view>
        </view>
      </view>

      <!-- 加速度计 -->
      <view class="sensor-group">
        <text class="sensor-group-title">加速度计（m/s²）</text>
        <view class="sensor-values">
          <view class="sensor-item" v-for="axis in ['x','y','z']" :key="'a'+axis">
            <text class="axis-label">{{ axis.toUpperCase() }}</text>
            <view class="bar-track">
              <view class="bar-fill" :style="{ width: barWidth(accelerometer[axis]) + '%' }"></view>
            </view>
            <text class="axis-value">{{ fmt(accelerometer[axis]) }}</text>
          </view>
        </view>
      </view>

      <!-- 设备方向 -->
      <view class="sensor-group">
        <text class="sensor-group-title">设备方向（°）</text>
        <view class="sensor-values">
          <view class="sensor-item" v-for="axis in ['alpha','beta','gamma']" :key="'o'+axis">
            <text class="axis-label">{{ axis.charAt(0).toUpperCase() + axis.slice(1) }}</text>
            <view class="bar-track">
              <view class="bar-fill orientation" :style="{ width: orientBarWidth(orientation[axis]) + '%' }"></view>
            </view>
            <text class="axis-value">{{ fmt(orientation[axis]) }}</text>
          </view>
        </view>
      </view>

      <view class="sensor-group">
        <text class="sensor-group-title">温度（°C）</text>
        <view class="sensor-values">
          <view class="sensor-item">
            <text class="axis-label">{{ temperatureSourceShortText(temperature.source) }}</text>
            <view class="bar-track">
              <view class="bar-fill temperature" :style="{ width: temperatureBarWidth(temperature.celsius) + '%' }"></view>
            </view>
            <text class="axis-value">{{ fmtTemperature(temperature.celsius) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 采集统计 -->
    <view class="card">
      <view class="card-title">采集统计</view>
      <view class="stats-grid">
        <view class="stat-item">
          <text class="stat-value">{{ stats.sent }}</text>
          <text class="stat-label">已发送</text>
        </view>
        <view class="stat-item">
          <text class="stat-value error-text">{{ stats.failed }}</text>
          <text class="stat-label">失败数</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ stats.rate }}</text>
          <text class="stat-label">采样率(Hz)</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ stats.duration }}</text>
          <text class="stat-label">采集时长(s)</text>
        </view>
      </view>
    </view>
    <!-- 调试日志 -->
    <view class="card" v-if="debugLogs.length > 0">
      <view class="card-title">调试日志</view>
      <view class="debug-logs">
        <text class="debug-line" v-for="(log, idx) in debugLogs" :key="idx">{{ log }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import AppSensorManager from '@/utils/appSensors.js'
import { buildCapabilityEnvelope, buildStatusEnvelope, buildTelemetryEnvelope } from '@/utils/protocol/envelope.js'
import TelemetryReporter from '@/utils/sensors/reporter.js'
import {
  buildCapabilitySnapshot,
  buildLegacySnapshot,
  buildStatusSnapshot,
  createCollectorState,
  resetCollectorState,
  updateSensorStatus as updateCollectorSensorStatus,
  updateSensorValue as updateCollectorSensorValue
} from '@/utils/sensors/state.js'
import SensorWebSocket from '@/utils/websocket.js'

export default {
  name: 'IndexPage',
  data() {
    return {
      serverUrl: 'ws://192.168.1.100:8080/ws/sensor',
      frequency: 30,
      freqOptions: [
        { label: '低频', hz: '10Hz', value: 10 },
        { label: '中频', hz: '30Hz', value: 30 },
        { label: '高频', hz: '60Hz', value: 60 }
      ],
      collecting: false,
      connected: false,
      sensorState: createCollectorState(),
      stats: { sent: 0, failed: 0, rate: 0, duration: 0 },
      ws: null,
      telemetryReporter: null,
      durationTimer: null,
      startTime: 0,
      frameCount: 0,
      lastRateTime: 0,
      debugLogs: [],
      _gyroLogged: false,
      _accelLogged: false,
      _orientationLogged: false,
      _temperatureLogged: false,
      appSensors: null,
      _firstSendLogged: false
    }
  },
  computed: {
    gyroscope() {
      return this.sensorState.values.gyroscope
    },
    accelerometer() {
      return this.sensorState.values.accelerometer
    },
    orientation() {
      return this.sensorState.values.orientation
    },
    temperature() {
      return this.sensorState.values.temperature
    },
    sensorStatusList() {
      return Object.values(this.sensorState.statuses)
    }
  },
  onUnload() {
    this.stopCollect()
  },
  methods: {
    setFrequency(val) {
      this.frequency = val
    },

    resetSensorState() {
      resetCollectorState(this.sensorState)
    },

    updateSensorStatus(sensor, state, detail) {
      updateCollectorSensorStatus(this.sensorState, sensor, state, detail)
    },

    updateSensorValue(sensor, value) {
      updateCollectorSensorValue(this.sensorState, sensor, value)
    },

    sensorStatusText(state) {
      const map = {
        idle: '未启动',
        starting: '启动中',
        active: '运行中',
        stopped: '已停止',
        unsupported: '不支持',
        unavailable: '无硬件',
        error: '异常'
      }
      return map[state] || '未知'
    },

    sensorStatusClass(state) {
      return `sensor-status-${state || 'idle'}`
    },

    toggleCollect() {
      if (this.collecting) {
        this.stopCollect()
      } else {
        this.startCollect()
      }
    },

    startCollect() {
      this.stats = { sent: 0, failed: 0, rate: 0, duration: 0 }
      this.frameCount = 0
      this.startTime = Date.now()
      this.lastRateTime = this.startTime
      this._gyroLogged = false
      this._accelLogged = false
      this._orientationLogged = false
      this._temperatureLogged = false
      this._firstSendLogged = false
      this.resetSensorState()
      this.addLog('开始采集...')

      this.ws = new SensorWebSocket({
        url: this.serverUrl,
        onConnected: () => {
          this.connected = true
          this.addLog('WebSocket 已连接')
          this.sendCapabilityMessage()
          this.sendStatusMessage()
        },
        onDisconnected: () => { this.connected = false; this.addLog('WebSocket 已断开') },
        onError: () => { this.connected = false; this.addLog('WebSocket 连接错误') }
      })
      this.ws.connect()

      if (!this.telemetryReporter) {
        this.telemetryReporter = new TelemetryReporter({
          getPayload: () => this.buildTelemetryPayload(),
          send: (payload) => this.ws ? this.ws.send(payload) : false,
          onSuccess: () => {
            if (!this._firstSendLogged) {
              this._firstSendLogged = true
              this.addLog('首次发送成功, gyro=' + JSON.stringify(this.gyroscope))
            }
            this.stats.sent++
          },
          onFailure: () => {
            this.stats.failed++
          }
        })
      }

      this.collecting = true
      this.startSensors()
      this.telemetryReporter.start(this.frequency)

      this.durationTimer = setInterval(() => {
        this.stats.duration = Math.round((Date.now() - this.startTime) / 1000)
        const elapsed = (Date.now() - this.lastRateTime) / 1000
        if (elapsed >= 1) {
          this.stats.rate = Math.round(this.frameCount / elapsed)
          this.frameCount = 0
          this.lastRateTime = Date.now()
        }
      }, 500)
    },

    stopCollect() {
      if (this.telemetryReporter) {
        this.telemetryReporter.stop()
      }
      if (this.durationTimer) {
        clearInterval(this.durationTimer)
        this.durationTimer = null
      }
      this.stopSensors()
      this.sendStatusMessage()
      this.sendCapabilityMessage()
      this.collecting = false
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
      this.connected = false
    },

    startSensors() {
      this.addLog('startSensors 被调用')
    
      // #ifdef APP-PLUS
      this.addLog('进入 APP-PLUS 分支')

      if (!this.appSensors) {
        this.appSensors = new AppSensorManager({
          onLog: (msg) => this.addLog(msg),
          onStatusChange: (sensor, state, detail) => {
            this.updateSensorStatus(sensor, state, detail)
            this.sendCapabilityMessage()
            this.sendStatusMessage()
          },
          onGyroscopeChange: (res) => {
            this.updateSensorValue('gyroscope', { x: res.x, y: res.y, z: res.z })
            this.updateSensorStatus('gyroscope', 'active', '已接收数据')
            if (!this._gyroLogged) {
              this._gyroLogged = true
              this.addLog('收到首个陀螺仪数据: ' + JSON.stringify(res))
            }
          },
          onAccelerometerChange: (res) => {
            this.updateSensorValue('accelerometer', { x: res.x, y: res.y, z: res.z })
            this.updateSensorStatus('accelerometer', 'active', '已接收数据')
            if (!this._accelLogged) {
              this._accelLogged = true
              this.addLog('收到首个加速度计数据: ' + JSON.stringify(res))
            }
          },
          onOrientationChange: (res) => {
            this.updateSensorValue('orientation', {
              alpha: res.alpha,
              beta: res.beta,
              gamma: res.gamma
            })
            this.updateSensorStatus('orientation', 'active', '已接收数据')
            if (!this._orientationLogged) {
              this._orientationLogged = true
              this.addLog('收到首个方向数据: ' + JSON.stringify(res))
            }
          },
          onTemperatureChange: (res) => {
            this.updateSensorValue('temperature', { celsius: res.celsius, source: res.source || null })
            this.updateSensorStatus('temperature', 'active', `${this.temperatureSourceText(res.source)}已接收数据`)
            if (!this._temperatureLogged) {
              this._temperatureLogged = true
              this.addLog('收到首个温度数据: ' + JSON.stringify(res))
            }
          }
        })
      }

      this.appSensors.start(this.frequency)
      this.addLog('App 端传感器启动流程已触发')
      // #endif
    },

    stopSensors() {
      // #ifdef APP-PLUS
      if (this.appSensors) {
        this.appSensors.stop()
        this.addLog('App 端传感器监听已停止')
      }
      // #endif

      // #ifdef H5
      if (this._onDeviceMotion) {
        window.removeEventListener('devicemotion', this._onDeviceMotion)
        this._onDeviceMotion = null
      }
      if (this._onDeviceOrientation) {
        window.removeEventListener('deviceorientation', this._onDeviceOrientation)
        this._onDeviceOrientation = null
      }
      // #endif
    },

    buildTelemetryPayload() {
      this.frameCount++
      const systemInfo = uni.getSystemInfoSync()
      const snapshot = buildLegacySnapshot(this.sensorState)
      const statusSnapshot = buildStatusSnapshot(this.sensorState)
      const payload = buildTelemetryEnvelope({
        deviceId: systemInfo.model || 'unknown-device',
        systemInfo,
        frequency: this.frequency,
        sensorStatus: statusSnapshot,
        gyroscope: snapshot.gyroscope,
        accelerometer: snapshot.accelerometer,
        orientation: snapshot.orientation,
        temperature: snapshot.temperature
      })
      return payload
    },

    buildCapabilityPayload() {
      const systemInfo = uni.getSystemInfoSync()
      return buildCapabilityEnvelope({
        deviceId: systemInfo.model || 'unknown-device',
        systemInfo,
        capabilities: buildCapabilitySnapshot(this.sensorState)
      })
    },

    buildStatusPayload() {
      const systemInfo = uni.getSystemInfoSync()
      return buildStatusEnvelope({
        deviceId: systemInfo.model || 'unknown-device',
        systemInfo,
        statuses: buildStatusSnapshot(this.sensorState)
      })
    },

    sendCapabilityMessage() {
      if (!this.ws) return false
      return this.ws.send(this.buildCapabilityPayload())
    },

    sendStatusMessage() {
      if (!this.ws) return false
      return this.ws.send(this.buildStatusPayload())
    },

    fmt(val) {
      return Number(val).toFixed(4)
    },

    barWidth(val) {
      const maxVal = 10
      const pct = (Math.abs(val) / maxVal) * 100
      return Math.min(pct, 100)
    },

    orientBarWidth(val) {
      return Math.min(Math.abs(val) / 360 * 100, 100)
    },

    temperatureBarWidth(val) {
      if (val === null || typeof val === 'undefined' || Number.isNaN(Number(val))) {
        return 0
      }
      return Math.min(Math.max(Number(val), 0), 60) / 60 * 100
    },

    fmtTemperature(val) {
      if (val === null || typeof val === 'undefined' || Number.isNaN(Number(val))) {
        return '--'
      }
      return `${Number(val).toFixed(2)} °C`
    },

    temperatureSourceText(source) {
      if (source === 'ambient') return '环境温度'
      if (source === 'battery') return '电池温度'
      return '温度'
    },

    temperatureSourceShortText(source) {
      if (source === 'ambient') return 'ENV'
      if (source === 'battery') return 'BAT'
      return 'TEMP'
    },

    addLog(msg) {
      const time = new Date().toLocaleTimeString()
      this.debugLogs.unshift(`[${time}] ${msg}`)
      if (this.debugLogs.length > 20) {
        this.debugLogs.pop()
      }
    }
  }
}
</script>

<style lang="scss">
.container {
  padding: 20rpx;
  background-color: #f0f2f5;
  min-height: 100vh;
}

.status-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 16rpx 0;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.status-connected {
  background-color: #f6ffed;
  border: 2rpx solid #b7eb8f;
}

.status-disconnected {
  background-color: #fff1f0;
  border: 2rpx solid #ffa39e;
}

.status-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  margin-right: 12rpx;
}

.status-connected .status-dot {
  background-color: #52c41a;
}

.status-disconnected .status-dot {
  background-color: #ff4d4f;
}

.status-text {
  font-size: 28rpx;
  font-weight: 500;
}

.status-connected .status-text {
  color: #52c41a;
}

.status-disconnected .status-text {
  color: #ff4d4f;
}

.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 20rpx;
  padding-left: 12rpx;
  border-left: 6rpx solid #1890ff;
}

.sensor-status-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.sensor-status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  background: #fafafa;
}

.sensor-status-main {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.sensor-status-label {
  font-size: 28rpx;
  color: #333333;
  font-weight: 600;
}

.sensor-status-detail {
  font-size: 24rpx;
  color: #999999;
}

.sensor-status-badge {
  min-width: 112rpx;
  text-align: center;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}

.sensor-status-idle,
.sensor-status-stopped {
  color: #666666;
  background: #f0f0f0;
}

.sensor-status-starting {
  color: #d48806;
  background: #fff7e6;
}

.sensor-status-active {
  color: #389e0d;
  background: #f6ffed;
}

.sensor-status-unsupported,
.sensor-status-unavailable {
  color: #531dab;
  background: #f9f0ff;
}

.sensor-status-error {
  color: #cf1322;
  background: #fff1f0;
}

.input-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.input-label {
  font-size: 28rpx;
  color: #666666;
  white-space: nowrap;
  margin-right: 10rpx;
}

.input-field {
  flex: 1;
  font-size: 26rpx;
  color: #333333;
  border: 2rpx solid #d9d9d9;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  background: #fafafa;
}

.freq-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.freq-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 0;
  border: 2rpx solid #d9d9d9;
  border-radius: 12rpx;
  margin: 0 8rpx;
  background: #fafafa;
}

.freq-btn:first-child {
  margin-left: 0;
}

.freq-btn:last-child {
  margin-right: 0;
}

.freq-btn-active {
  border-color: #1890ff;
  background: #e6f7ff;
}

.freq-label {
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
}

.freq-btn-active .freq-label {
  color: #1890ff;
}

.freq-hz {
  font-size: 24rpx;
  color: #999999;
  margin-top: 4rpx;
}

.freq-btn-active .freq-hz {
  color: #1890ff;
}

.btn-row {
  margin-bottom: 20rpx;
}

.ctrl-btn {
  width: 100%;
  height: 90rpx;
  border-radius: 16rpx;
  font-size: 34rpx;
  font-weight: 600;
  border: none;
  line-height: 90rpx;
}

.btn-start {
  background: #1890ff;
  color: #ffffff;
}

.btn-stop {
  background: #ff4d4f;
  color: #ffffff;
}

.sensor-group {
  margin-bottom: 24rpx;
}

.sensor-group:last-child {
  margin-bottom: 0;
}

.sensor-group-title {
  font-size: 26rpx;
  color: #1890ff;
  font-weight: 500;
  margin-bottom: 12rpx;
  display: block;
}

.sensor-values {
  display: flex;
  flex-direction: column;
}

.sensor-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 10rpx;
}

.axis-label {
  font-size: 26rpx;
  color: #666666;
  width: 80rpx;
  font-weight: 600;
}

.bar-track {
  flex: 1;
  height: 16rpx;
  background: #f0f2f5;
  border-radius: 8rpx;
  overflow: hidden;
  margin: 0 16rpx;
}

.bar-fill {
  height: 100%;
  background: #1890ff;
  border-radius: 8rpx;
  transition: width 0.1s ease;
  min-width: 4rpx;
}

.bar-fill.orientation {
  background: #722ed1;
}

.bar-fill.temperature {
  background: #fa8c16;
}

.axis-value {
  font-size: 24rpx;
  color: #333333;
  width: 120rpx;
  text-align: right;
  font-family: monospace;
}

.stats-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.stat-item {
  width: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 0;
}

.stat-value {
  font-size: 44rpx;
  font-weight: 700;
  color: #1890ff;
}

.stat-value.error-text {
  color: #ff4d4f;
}

.error-text {
  color: #ff4d4f;
}

.stat-label {
  font-size: 24rpx;
  color: #999999;
  margin-top: 4rpx;
}

.debug-logs {
  max-height: 400rpx;
  overflow-y: auto;
}

.debug-line {
  display: block;
  font-size: 22rpx;
  color: #666666;
  font-family: monospace;
  padding: 4rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}
</style>
