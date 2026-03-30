export default {
  key: 'accelerometer',
  label: '加速度计',
  icon: '📐',
  unit: 'm/s²',
  widgets: ['card', 'chart', 'table'],
  fields: [
    { key: 'x', label: 'X', precision: 4, type: 'number', color: 'blue', chart: true, tableTitle: '加速度 X' },
    { key: 'y', label: 'Y', precision: 4, type: 'number', color: 'green', chart: true, tableTitle: '加速度 Y' },
    { key: 'z', label: 'Z', precision: 4, type: 'number', color: 'orange', chart: true, tableTitle: '加速度 Z' }
  ]
}
