export function formatTemperatureSource(value) {
  if (value === 'ambient') return '环境温度'
  if (value === 'battery') return '电池温度'
  return '暂无数据'
}

export function formatCapabilityState(value) {
  if (value === 'supported') return '支持'
  if (value === 'unavailable') return '无硬件'
  if (value === 'unsupported') return '不支持'
  return '未知'
}

export function formatRuntimeStatus(value) {
  if (value === 'idle') return '未启动'
  if (value === 'starting') return '启动中'
  if (value === 'active') return '运行中'
  if (value === 'stopped') return '已停止'
  if (value === 'unsupported') return '不支持'
  if (value === 'unavailable') return '无硬件'
  if (value === 'error') return '异常'
  return '未知'
}

export function formatNumber(value, precision = 2, suffix = '') {
  const numberValue = Number(value)
  if (value == null || !Number.isFinite(numberValue)) {
    return '--'
  }
  return `${numberValue.toFixed(precision)}${suffix}`
}

export function formatFieldValue(field, value) {
  if (field.formatter === 'temperatureSource') {
    return formatTemperatureSource(value)
  }

  if (field.type === 'number') {
    return formatNumber(value, field.precision ?? 2, field.suffix || '')
  }

  if (value == null || value === '') {
    return '--'
  }

  return String(value)
}

export function toChartValue(field, value) {
  if (field.type !== 'number') {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

export function capabilityTagColor(value) {
  if (value === 'supported') return 'green'
  if (value === 'unavailable') return 'gold'
  if (value === 'unsupported') return 'default'
  return 'default'
}

export function runtimeStatusTagColor(value) {
  if (value === 'active') return 'green'
  if (value === 'starting') return 'processing'
  if (value === 'stopped') return 'default'
  if (value === 'unavailable') return 'gold'
  if (value === 'unsupported') return 'default'
  if (value === 'error') return 'red'
  return 'default'
}
