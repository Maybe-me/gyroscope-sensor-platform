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
  </view>
</template>

<script>
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
      gyroscope: { x: 0, y: 0, z: 0 },
      accelerometer: { x: 0, y: 0, z: 0 },
      orientation: { alpha: 0, beta: 0, gamma: 0 },
      stats: { sent: 0, failed: 0, rate: 0, duration: 0 },
      ws: null,
      collectTimer: null,
      durationTimer: null,
      startTime: 0,
      frameCount: 0,
      lastRateTime: 0
    }
  },
  onUnload() {
    this.stopCollect()
  },
  methods: {
    setFrequency(val) {
      this.frequency = val
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

      this.ws = new SensorWebSocket({
        url: this.serverUrl,
        onConnected: () => { this.connected = true },
        onDisconnected: () => { this.connected = false },
        onError: () => { this.connected = false }
      })
      this.ws.connect()

      this.collecting = true
      this.startSensors()

      const interval = Math.round(1000 / this.frequency)
      this.collectTimer = setInterval(() => {
        this.sendData()
      }, interval)

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
      this.collecting = false
      if (this.collectTimer) {
        clearInterval(this.collectTimer)
        this.collectTimer = null
      }
      if (this.durationTimer) {
        clearInterval(this.durationTimer)
        this.durationTimer = null
      }
      this.stopSensors()
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
      this.connected = false
    },

    startSensors() {
      // #ifdef APP-PLUS
      uni.startGyroscope({
        interval: 'ui',
        success: () => {},
        fail: (err) => { console.error('陀螺仪启动失败:', err) }
      })
      uni.onGyroscopeChange((res) => {
        this.gyroscope = { x: res.x, y: res.y, z: res.z }
      })

      uni.startAccelerometer({
        interval: 'ui',
        success: () => {},
        fail: (err) => { console.error('加速度计启动失败:', err) }
      })
      uni.onAccelerometerChange((res) => {
        this.accelerometer = { x: res.x, y: res.y, z: res.z }
      })

      uni.startCompass({
        success: () => {},
        fail: (err) => { console.error('指南针启动失败:', err) }
      })
      uni.onCompassChange((res) => {
        this.orientation.alpha = res.direction || 0
      })
      // #endif

      // #ifdef H5
      this._onDeviceMotion = (e) => {
        if (e.rotationRate) {
          // DeviceMotionEvent.rotationRate: alpha=Z-axis, beta=X-axis, gamma=Y-axis
          this.gyroscope = {
            x: e.rotationRate.beta || 0,
            y: e.rotationRate.gamma || 0,
            z: e.rotationRate.alpha || 0
          }
        }
        if (e.accelerationIncludingGravity) {
          this.accelerometer = {
            x: e.accelerationIncludingGravity.x || 0,
            y: e.accelerationIncludingGravity.y || 0,
            z: e.accelerationIncludingGravity.z || 0
          }
        }
      }
      this._onDeviceOrientation = (e) => {
        this.orientation = {
          alpha: e.alpha || 0,
          beta: e.beta || 0,
          gamma: e.gamma || 0
        }
      }
      window.addEventListener('devicemotion', this._onDeviceMotion)
      window.addEventListener('deviceorientation', this._onDeviceOrientation)
      // #endif
    },

    stopSensors() {
      // #ifdef APP-PLUS
      uni.stopGyroscope({ success: () => {}, fail: () => {} })
      uni.stopAccelerometer({ success: () => {}, fail: () => {} })
      uni.stopCompass({ success: () => {}, fail: () => {} })
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

    sendData() {
      if (!this.ws) return
      this.frameCount++
      const payload = {
        deviceId: uni.getSystemInfoSync().model || 'unknown-device',
        timestamp: Date.now(),
        gyroscope: { ...this.gyroscope },
        accelerometer: { ...this.accelerometer },
        orientation: { ...this.orientation }
      }
      const ok = this.ws.send(payload)
      if (ok) {
        this.stats.sent++
      } else {
        this.stats.failed++
      }
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
</style>
