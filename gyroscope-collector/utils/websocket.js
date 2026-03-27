class SensorWebSocket {
  constructor(options = {}) {
    this.url = options.url || 'ws://192.168.1.100:8080/ws/sensor'
    this.reconnectInterval = options.reconnectInterval || 3000
    this.heartbeatInterval = options.heartbeatInterval || 30000
    this.socketTask = null
    this.isConnected = false
    this.reconnectTimer = null
    this.heartbeatTimer = null

    this.onConnected = options.onConnected || (() => {})
    this.onDisconnected = options.onDisconnected || (() => {})
    this.onError = options.onError || (() => {})
    this.onMessage = options.onMessage || (() => {})
  }

  connect() {
    if (this.socketTask) {
      this.close()
    }

    this.socketTask = uni.connectSocket({
      url: this.url,
      success: () => {
        console.log('WebSocket 连接请求已发送')
      },
      fail: (err) => {
        console.error('WebSocket 连接失败:', err)
        this.scheduleReconnect()
      }
    })

    this.socketTask.onOpen(() => {
      console.log('WebSocket 已连接')
      this.isConnected = true
      this.clearReconnect()
      this.startHeartbeat()
      this.onConnected()
    })

    this.socketTask.onMessage((res) => {
      this.onMessage(res.data)
    })

    this.socketTask.onClose(() => {
      console.log('WebSocket 已断开')
      this.isConnected = false
      this.stopHeartbeat()
      this.onDisconnected()
      this.scheduleReconnect()
    })

    this.socketTask.onError((err) => {
      console.error('WebSocket 错误:', err)
      this.isConnected = false
      this.onError(err)
    })
  }

  send(data) {
    if (!this.isConnected || !this.socketTask) {
      console.warn('WebSocket 未连接，数据丢弃')
      return false
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data)
    this.socketTask.send({
      data: message,
      fail: (err) => {
        console.error('发送失败:', err)
      }
    })
    return true
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'heartbeat', timestamp: Date.now() })
    }, this.heartbeatInterval)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  scheduleReconnect() {
    this.clearReconnect()
    this.reconnectTimer = setTimeout(() => {
      console.log('尝试重新连接...')
      this.connect()
    }, this.reconnectInterval)
  }

  clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  close() {
    this.clearReconnect()
    this.stopHeartbeat()
    if (this.socketTask) {
      this.socketTask.close()
      this.socketTask = null
    }
    this.isConnected = false
  }
}

export default SensorWebSocket
