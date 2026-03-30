export default class TelemetryReporter {
  constructor(options = {}) {
    this.getPayload = options.getPayload || (() => null)
    this.send = options.send || (() => false)
    this.onSuccess = options.onSuccess || (() => {})
    this.onFailure = options.onFailure || (() => {})
    this.timer = null
  }

  start(frequency) {
    this.stop()
    const interval = Math.max(16, Math.round(1000 / Number(frequency || 30)))
    this.timer = setInterval(() => {
      this.flush()
    }, interval)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  flush() {
    const payload = this.getPayload()
    if (!payload) {
      this.onFailure()
      return false
    }

    const ok = this.send(payload)
    if (ok) {
      this.onSuccess(payload)
    } else {
      this.onFailure(payload)
    }
    return ok
  }
}
