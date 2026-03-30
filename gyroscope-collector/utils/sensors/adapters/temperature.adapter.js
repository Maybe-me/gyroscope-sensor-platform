function processBatteryIntent(ctx, batteryIntent) {
  if (!batteryIntent) {
    ctx.setStatus('temperature', 'error', '无法读取电池温度')
    return
  }

  plus.android.importClass(batteryIntent)
  const raw = batteryIntent.getIntExtra('temperature', -1)
  if (raw < 0) {
    ctx.setStatus('temperature', 'unavailable', '电池温度不可用')
    return
  }

  ctx.emit('temperature', {
    celsius: Number(raw) / 10,
    source: 'battery'
  })
}

function startAndroidBatteryTemperature(ctx) {
  try {
    const main = plus.android.runtimeMainActivity()
    const IntentFilter = plus.android.importClass('android.content.IntentFilter')
    const filter = new IntentFilter()
    filter.addAction('android.intent.action.BATTERY_CHANGED')

    const runtime = ctx.getRuntime('temperature')
    runtime.batteryReceiver = plus.android.implements('io.dcloud.feature.internal.reflect.BroadcastReceiver', {
      onReceive: (context, intent) => {
        processBatteryIntent(ctx, intent)
      }
    })

    const stickyIntent = main.registerReceiver(runtime.batteryReceiver, filter)
    processBatteryIntent(ctx, stickyIntent)

    ctx.setStatus('temperature', 'active', 'Android 电池温度监听中')
    ctx.log('Android 电池温度兜底已启动')
  } catch (err) {
    ctx.setStatus('temperature', 'error', '电池温度启动失败')
    ctx.log('启动电池温度兜底失败: ' + ctx.stringifyError(err))
  }
}

export default {
  key: 'temperature',

  start(ctx) {
    ctx.setStatus('temperature', 'starting', '启动中')

    if (!plus.os) {
      ctx.setStatus('temperature', 'error', '无法识别平台')
      return
    }

    if (plus.os.name !== 'Android') {
      ctx.setStatus('temperature', 'unsupported', '当前平台不提供数值温度')
      ctx.log('温度传感器仅在部分 Android 设备上可用')
      return
    }

    try {
      const main = plus.android.runtimeMainActivity()
      const Context = plus.android.importClass('android.content.Context')
      const SensorManager = plus.android.importClass('android.hardware.SensorManager')
      const Sensor = plus.android.importClass('android.hardware.Sensor')
      const sensorManager = main.getSystemService(Context.SENSOR_SERVICE)
      plus.android.importClass(sensorManager)
      const temperatureSensor = sensorManager.getDefaultSensor(Sensor.TYPE_AMBIENT_TEMPERATURE)

      if (!temperatureSensor) {
        ctx.log('设备未检测到环境温度传感器，切换为电池温度兜底')
        startAndroidBatteryTemperature(ctx)
        return
      }

      const runtime = ctx.getRuntime('temperature')
      runtime.androidSensorManager = sensorManager
      runtime.androidSensor = temperatureSensor
      runtime.androidListener = plus.android.implements('android.hardware.SensorEventListener', {
        onSensorChanged: (event) => {
          try {
            const values = event.plusGetAttribute('values')
            ctx.emit('temperature', {
              celsius: Number(values[0] || 0),
              source: 'ambient'
            })
          } catch (err) {
            ctx.log('读取温度传感器数据失败: ' + ctx.stringifyError(err))
          }
        },
        onAccuracyChanged: () => {}
      })

      sensorManager.registerListener(
        runtime.androidListener,
        temperatureSensor,
        ctx.getAndroidSensorDelay(SensorManager, ctx.frequency)
      )

      ctx.setStatus('temperature', 'active', 'Android 环境温度监听中')
      ctx.log('Android 环境温度传感器监听已启动')
    } catch (err) {
      ctx.setStatus('temperature', 'error', '温度传感器启动失败')
      ctx.log('启动温度传感器失败: ' + ctx.stringifyError(err))
    }
  },

  stop(ctx) {
    const runtime = ctx.getRuntime('temperature')

    try {
      if (plus.os && plus.os.name === 'Android' && runtime.androidSensorManager && runtime.androidListener) {
        runtime.androidSensorManager.unregisterListener(runtime.androidListener)
      }
    } catch (err) {
      ctx.log('停止温度传感器监听失败: ' + ctx.stringifyError(err))
    }

    if (runtime.batteryReceiver && plus.os && plus.os.name === 'Android') {
      try {
        const main = plus.android.runtimeMainActivity()
        main.unregisterReceiver(runtime.batteryReceiver)
      } catch (err) {
        ctx.log('停止电池温度监听失败: ' + ctx.stringifyError(err))
      } finally {
        runtime.batteryReceiver = null
      }
    }

    ctx.clearRuntime('temperature')
  }
}
