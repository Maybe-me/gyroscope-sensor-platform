const SCHEMA_VERSION = 2

function normalizePlatform(systemInfo = {}) {
  return String(systemInfo.platform || systemInfo.osName || 'unknown').toLowerCase()
}

function buildDevice(deviceId, systemInfo = {}) {
  return {
    id: deviceId || systemInfo.deviceId || systemInfo.model || 'unknown-device',
    model: systemInfo.model || 'unknown-model',
    brand: systemInfo.brand || 'unknown-brand',
    platform: normalizePlatform(systemInfo)
  }
}

function buildSensorEntry(type, values, statusEntry, meta = {}) {
  const entry = {
    type,
    status: statusEntry?.state || 'active',
    values: { ...values }
  }

  const extraMeta = statusEntry?.detail ? { detail: statusEntry.detail } : {}
  if (Object.keys(meta).length > 0) {
    entry.meta = { ...meta, ...extraMeta }
  } else if (Object.keys(extraMeta).length > 0) {
    entry.meta = extraMeta
  }

  return entry
}

function buildStatusSensorEntry(type, statusEntry = {}) {
  return {
    type,
    label: statusEntry.label || type,
    state: statusEntry.state || 'idle',
    detail: statusEntry.detail || ''
  }
}

function buildCapabilitySensorEntry(type, capabilityEntry = {}) {
  return {
    type,
    label: capabilityEntry.label || type,
    supported: capabilityEntry.supported !== false,
    available: capabilityEntry.available !== false,
    state: capabilityEntry.state || 'idle',
    detail: capabilityEntry.detail || ''
  }
}

export function buildTelemetryEnvelope({
  deviceId,
  systemInfo,
  frequency,
  sensorStatus,
  gyroscope,
  accelerometer,
  orientation,
  temperature
}) {
  const device = buildDevice(deviceId, systemInfo)
  const timestamp = Date.now()

  const sensors = {
    gyroscope: buildSensorEntry('gyroscope', gyroscope, sensorStatus?.gyroscope, { unit: 'rad/s' }),
    accelerometer: buildSensorEntry('accelerometer', accelerometer, sensorStatus?.accelerometer, { unit: 'm/s²' }),
    orientation: buildSensorEntry('orientation', orientation, sensorStatus?.orientation, { unit: '°' }),
    temperature: buildSensorEntry(
      'temperature',
      { celsius: temperature?.celsius ?? null },
      sensorStatus?.temperature,
      {
        unit: '°C',
        ...(temperature?.source ? { source: temperature.source } : {})
      }
    )
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    msgType: 'telemetry',
    device,
    timestamp,
    sampling: {
      targetHz: Number(frequency || 0)
    },
    sensors,
    deviceId: device.id,
    gyroscope: { ...gyroscope },
    accelerometer: { ...accelerometer },
    orientation: { ...orientation },
    temperature: { ...temperature }
  }
}

export function buildHeartbeatEnvelope({ deviceId, systemInfo }) {
  const device = buildDevice(deviceId, systemInfo)

  return {
    schemaVersion: SCHEMA_VERSION,
    msgType: 'heartbeat',
    timestamp: Date.now(),
    device,
    deviceId: device.id
  }
}

export function buildCapabilityEnvelope({ deviceId, systemInfo, capabilities }) {
  const device = buildDevice(deviceId, systemInfo)
  const sensors = Object.keys(capabilities || {}).reduce((acc, key) => {
    acc[key] = buildCapabilitySensorEntry(key, capabilities[key])
    return acc
  }, {})

  return {
    schemaVersion: SCHEMA_VERSION,
    msgType: 'capability',
    timestamp: Date.now(),
    device,
    deviceId: device.id,
    sensors
  }
}

export function buildStatusEnvelope({ deviceId, systemInfo, statuses }) {
  const device = buildDevice(deviceId, systemInfo)
  const sensors = Object.keys(statuses || {}).reduce((acc, key) => {
    acc[key] = buildStatusSensorEntry(key, statuses[key])
    return acc
  }, {})

  return {
    schemaVersion: SCHEMA_VERSION,
    msgType: 'status',
    timestamp: Date.now(),
    device,
    deviceId: device.id,
    sensors
  }
}
