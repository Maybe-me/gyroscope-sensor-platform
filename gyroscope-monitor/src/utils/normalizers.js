function getSensorValues(data, key) {
  const sensor = data.sensors?.[key]
  if (sensor?.values) {
    const values = { ...sensor.values }
    if (sensor.meta) {
      Object.keys(sensor.meta).forEach((metaKey) => {
        if (values[metaKey] == null) {
          values[metaKey] = sensor.meta[metaKey]
        }
      })
    }
    return values
  }
  return data[key] || {}
}

export function createEmptySensors(sensorSchemas) {
  return sensorSchemas.reduce((acc, schema) => {
    acc[schema.key] = schema.fields.reduce((fieldAcc, field) => {
      fieldAcc[field.key] = null
      return fieldAcc
    }, {})
    return acc
  }, {})
}

export function createEmptyCapabilityState(sensorSchemas) {
  return sensorSchemas.reduce((acc, schema) => {
    acc[schema.key] = {
      capability: 'unknown',
      detail: ''
    }
    return acc
  }, {})
}

export function createEmptyStatusState(sensorSchemas) {
  return sensorSchemas.reduce((acc, schema) => {
    acc[schema.key] = {
      state: 'idle',
      detail: ''
    }
    return acc
  }, {})
}

export function createEmptySeriesState(sensorSchemas) {
  return sensorSchemas.reduce((acc, schema) => {
    const chartFields = schema.fields.filter((field) => field.chart)
    if (chartFields.length > 0) {
      acc[schema.key] = chartFields.reduce((fieldAcc, field) => {
        fieldAcc[field.key] = []
        return fieldAcc
      }, {})
    }
    return acc
  }, {})
}

export function normalizeTelemetryMessage(data, sensorSchemas) {
  const sensors = createEmptySensors(sensorSchemas)
  const sensorStatuses = createEmptyStatusState(sensorSchemas)

  sensorSchemas.forEach((schema) => {
    const values = getSensorValues(data, schema.key)
    schema.fields.forEach((field) => {
      sensors[schema.key][field.key] = values[field.key] == null ? null : values[field.key]
    })
    const sensorPayload = data.sensors?.[schema.key]
    if (sensorPayload?.status) {
      sensorStatuses[schema.key] = {
        state: sensorPayload.status,
        detail: sensorPayload.meta?.detail || ''
      }
    }
  })

  return {
    schemaVersion: data.schemaVersion ?? 1,
    msgType: data.msgType ?? 'telemetry',
    timestamp: data.timestamp ?? Date.now(),
    device: data.device || null,
    deviceId: data.device?.id || data.deviceId || 'unknown-device',
    sensors,
    sensorStatuses
  }
}

export function normalizeCapabilityMessage(data, sensorSchemas) {
  const capabilityState = createEmptyCapabilityState(sensorSchemas)

  sensorSchemas.forEach((schema) => {
    const sensor = data.sensors?.[schema.key]
    if (!sensor) {
      return
    }

    let capability = 'unknown'
    if (sensor.supported === false) {
      capability = 'unsupported'
    } else if (sensor.available === false) {
      capability = 'unavailable'
    } else if (sensor.supported === true) {
      capability = 'supported'
    }

    capabilityState[schema.key] = {
      capability,
      detail: sensor.detail || ''
    }
  })

  return capabilityState
}

export function normalizeStatusMessage(data, sensorSchemas) {
  const statusState = createEmptyStatusState(sensorSchemas)

  sensorSchemas.forEach((schema) => {
    const sensor = data.sensors?.[schema.key]
    if (!sensor) {
      return
    }

    statusState[schema.key] = {
      state: sensor.state || 'idle',
      detail: sensor.detail || ''
    }
  })

  return statusState
}
