import sensorRegistry from '@/utils/sensors/registry.js'

class AppSensorManager {
  constructor(options = {}) {
    this.onGyroscopeChange = options.onGyroscopeChange || (() => {})
    this.onAccelerometerChange = options.onAccelerometerChange || (() => {})
    this.onOrientationChange = options.onOrientationChange || (() => {})
    this.onTemperatureChange = options.onTemperatureChange || (() => {})
    this.onStatusChange = options.onStatusChange || (() => {})
    this.onLog = options.onLog || (() => {})

    this.adapters = sensorRegistry
    this.runtime = {}
    this.frequency = 30
  }

  start(frequency = 30) {
    this.stop()
    this.frequency = Number(frequency || 30)

    if (typeof plus === 'undefined') {
      this.adapters.forEach((adapter) => {
        this.setStatus(adapter.key, 'error', 'plus API 未就绪')
      })
      this.onLog('plus API 未就绪，无法启动 App 端传感器')
      return
    }

    const ctx = this.createContext()
    this.adapters.forEach((adapter) => {
      adapter.start(ctx)
    })
  }

  stop() {
    if (typeof plus === 'undefined') {
      return
    }

    const ctx = this.createContext()
    this.adapters.forEach((adapter) => {
      try {
        adapter.stop(ctx)
      } catch (err) {
        this.onLog(`停止 ${adapter.key} 失败: ${this.stringifyError(err)}`)
      }
    })

    this.runtime = {}
    this.adapters.forEach((adapter) => {
      this.setStatus(adapter.key, 'stopped', '已停止')
    })
  }

  createContext() {
    return {
      frequency: this.frequency,
      emit: (sensor, payload) => this.emit(sensor, payload),
      log: (message) => this.onLog(message),
      setStatus: (sensor, state, detail) => this.setStatus(sensor, state, detail),
      getRuntime: (sensor) => {
        if (!this.runtime[sensor]) {
          this.runtime[sensor] = {}
        }
        return this.runtime[sensor]
      },
      clearRuntime: (sensor) => {
        delete this.runtime[sensor]
      },
      getWatchFrequency: (frequency) => this.getWatchFrequency(frequency),
      getAndroidSensorDelay: (SensorManager, frequency) => this.getAndroidSensorDelay(SensorManager, frequency),
      stringifyError: (err) => this.stringifyError(err),
      readIOSNumber: (obj, key) => this.readIOSNumber(obj, key),
      deleteIOSObject: (obj) => this.deleteIOSObject(obj)
    }
  }

  emit(sensor, payload) {
    if (sensor === 'gyroscope') {
      this.onGyroscopeChange(payload)
      return
    }
    if (sensor === 'accelerometer') {
      this.onAccelerometerChange(payload)
      return
    }
    if (sensor === 'orientation') {
      this.onOrientationChange(payload)
      return
    }
    if (sensor === 'temperature') {
      this.onTemperatureChange(payload)
    }
  }

  getWatchFrequency(frequency) {
    return Math.max(16, Math.round(1000 / Number(frequency || 30)))
  }

  getAndroidSensorDelay(SensorManager, frequency) {
    if (frequency >= 60) return SensorManager.SENSOR_DELAY_GAME
    if (frequency >= 30) return SensorManager.SENSOR_DELAY_UI
    return SensorManager.SENSOR_DELAY_NORMAL
  }

  stringifyError(err) {
    try {
      return JSON.stringify(err)
    } catch (jsonErr) {
      return String(err)
    }
  }

  readIOSNumber(obj, key) {
    if (!obj) return 0
    let value = null

    if (typeof obj.plusGetAttribute === 'function') {
      value = obj.plusGetAttribute(key)
    }

    if (value === null || typeof value === 'undefined') {
      value = plus.ios.invoke(obj, key)
    }

    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : 0
  }

  deleteIOSObject(obj) {
    if (!obj || typeof plus === 'undefined' || !plus.ios || !plus.ios.deleteObject) {
      return
    }
    try {
      plus.ios.deleteObject(obj)
    } catch (err) {
      this.onLog('释放 iOS 对象失败: ' + this.stringifyError(err))
    }
  }

  setStatus(sensor, state, detail) {
    this.onStatusChange(sensor, state, detail)
  }
}

export default AppSensorManager
