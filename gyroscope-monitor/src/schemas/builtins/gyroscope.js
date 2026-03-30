export default {
  key: 'gyroscope',
  label: '陀螺仪',
  icon: '🔄',
  unit: 'rad/s',
  widgets: ['card', 'chart', 'table'],
  fields: [
    { key: 'x', label: 'X', precision: 4, type: 'number', color: 'blue', chart: true, tableTitle: '陀螺仪 X' },
    { key: 'y', label: 'Y', precision: 4, type: 'number', color: 'green', chart: true, tableTitle: '陀螺仪 Y' },
    { key: 'z', label: 'Z', precision: 4, type: 'number', color: 'orange', chart: true, tableTitle: '陀螺仪 Z' }
  ]
}
