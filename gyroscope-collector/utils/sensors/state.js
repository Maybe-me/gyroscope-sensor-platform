export function createSensorStatusMap() {
  return {
    gyroscope: { key: 'gyroscope', label: '陀螺仪', state: 'idle', detail: '未启动' },
    accelerometer: { key: 'accelerometer', label: '加速度计', state: 'idle', detail: '未启动' },
    orientation: { key: 'orientation', label: '方向传感器', state: 'idle', detail: '未启动' },
    temperature: { key: 'temperature', label: '温度', state: 'idle', detail: '未启动' }
  }
}

export function createSensorValueMap() {
  return {
    gyroscope: { x: 0, y: 0, z: 0 },
    accelerometer: { x: 0, y: 0, z: 0 },
    orientation: { alpha: 0, beta: 0, gamma: 0 },
    temperature: { celsius: null, source: null }
  }
}

export function createCollectorState() {
  return {
    values: createSensorValueMap(),
    statuses: createSensorStatusMap()
  }
}

export function resetCollectorState(state) {
  state.values = createSensorValueMap()
  state.statuses = createSensorStatusMap()
}

export function updateSensorStatus(state, sensor, nextState, detail) {
  const current = state.statuses[sensor]
  if (!current) {
    return
  }

  state.statuses = {
    ...state.statuses,
    [sensor]: {
      ...current,
      state: nextState,
      detail
    }
  }
}

export function updateSensorValue(state, sensor, value) {
  if (!(sensor in state.values)) {
    return
  }

  state.values = {
    ...state.values,
    [sensor]: { ...value }
  }
}

export function buildLegacySnapshot(state) {
  return {
    gyroscope: { ...state.values.gyroscope },
    accelerometer: { ...state.values.accelerometer },
    orientation: { ...state.values.orientation },
    temperature: { ...state.values.temperature }
  }
}

export function buildStatusSnapshot(state) {
  return Object.keys(state.statuses).reduce((acc, key) => {
    acc[key] = { ...state.statuses[key] }
    return acc
  }, {})
}

export function buildCapabilitySnapshot(state) {
  return Object.keys(state.statuses).reduce((acc, key) => {
    const entry = state.statuses[key]
    acc[key] = {
      key: entry.key,
      label: entry.label,
      supported: entry.state !== 'unsupported',
      available: !['unsupported', 'unavailable'].includes(entry.state),
      state: entry.state,
      detail: entry.detail
    }
    return acc
  }, {})
}
