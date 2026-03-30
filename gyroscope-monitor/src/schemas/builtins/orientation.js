export default {
  key: 'orientation',
  label: '设备姿态',
  icon: '🧭',
  unit: '°',
  widgets: ['card', 'table'],
  fields: [
    { key: 'alpha', label: 'Alpha (Z轴)', precision: 2, type: 'number', color: 'blue', suffix: '°', tableTitle: '姿态 Alpha' },
    { key: 'beta', label: 'Beta (X轴)', precision: 2, type: 'number', color: 'green', suffix: '°', tableTitle: '姿态 Beta' },
    { key: 'gamma', label: 'Gamma (Y轴)', precision: 2, type: 'number', color: 'orange', suffix: '°', tableTitle: '姿态 Gamma' }
  ]
}
