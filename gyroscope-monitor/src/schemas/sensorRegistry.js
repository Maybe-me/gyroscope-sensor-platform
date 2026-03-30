import gyroscope from './builtins/gyroscope.js'
import accelerometer from './builtins/accelerometer.js'
import orientation from './builtins/orientation.js'
import temperature from './builtins/temperature.js'

export const sensorSchemas = [
  gyroscope,
  accelerometer,
  orientation,
  temperature
]

export const sensorSchemaMap = sensorSchemas.reduce((acc, schema) => {
  acc[schema.key] = schema
  return acc
}, {})
