export default {
  key: 'temperature',
  label: '温度',
  icon: '🌡️',
  unit: '°C',
  widgets: ['card', 'chart', 'table'],
  fields: [
    { key: 'celsius', label: '温度', precision: 2, type: 'number', color: 'volcano', suffix: ' °C', chart: true, tableTitle: '温度 (°C)' },
    { key: 'source', label: '来源', type: 'enum', formatter: 'temperatureSource', color: 'green', tableTitle: '温度来源' }
  ]
}
