function startAndroidGyroscope(ctx) {
  try {
    const main = plus.android.runtimeMainActivity()
    const Context = plus.android.importClass('android.content.Context')
    const SensorManager = plus.android.importClass('android.hardware.SensorManager')
    const Sensor = plus.android.importClass('android.hardware.Sensor')
    const sensorManager = main.getSystemService(Context.SENSOR_SERVICE)
    plus.android.importClass(sensorManager)
    const gyroSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

    if (!gyroSensor) {
      ctx.setStatus('gyroscope', 'unavailable', '设备无陀螺仪')
      ctx.log('设备未检测到陀螺仪传感器')
      return
    }

    const runtime = ctx.getRuntime('gyroscope')
    runtime.androidSensorManager = sensorManager
    runtime.androidSensor = gyroSensor
    runtime.androidListener = plus.android.implements('android.hardware.SensorEventListener', {
      onSensorChanged: (event) => {
        try {
          const values = event.plusGetAttribute('values')
          ctx.emit('gyroscope', {
            x: Number(values[0] || 0),
            y: Number(values[1] || 0),
            z: Number(values[2] || 0)
          })
        } catch (err) {
          ctx.log('读取陀螺仪数据失败: ' + ctx.stringifyError(err))
        }
      },
      onAccuracyChanged: () => {}
    })

    sensorManager.registerListener(
      runtime.androidListener,
      gyroSensor,
      ctx.getAndroidSensorDelay(SensorManager, ctx.frequency)
    )

    ctx.setStatus('gyroscope', 'active', 'Android 原生监听中')
    ctx.log('Android 原生陀螺仪监听已启动')
  } catch (err) {
    ctx.setStatus('gyroscope', 'error', 'Android 原生启动失败')
    ctx.log('启动 Android 原生陀螺仪失败: ' + ctx.stringifyError(err))
  }
}

function startIOSGyroscope(ctx) {
  try {
    const watchFrequency = ctx.getWatchFrequency(ctx.frequency)
    const CMMotionManager = plus.ios.importClass('CMMotionManager')
    if (!CMMotionManager) {
      ctx.setStatus('gyroscope', 'error', 'CMMotionManager 不可用')
      ctx.log('iOS 陀螺仪初始化失败: 无法导入 CMMotionManager')
      return
    }

    const motionManager = plus.ios.newObject('CMMotionManager')
    if (!motionManager) {
      ctx.setStatus('gyroscope', 'error', '无法创建 CMMotionManager')
      ctx.log('iOS 陀螺仪初始化失败: 无法创建 CMMotionManager')
      return
    }

    const isGyroAvailable = plus.ios.invoke(motionManager, 'isGyroAvailable')
    if (!isGyroAvailable) {
      ctx.setStatus('gyroscope', 'unavailable', '设备无陀螺仪')
      ctx.log('iOS 设备未检测到陀螺仪')
      ctx.deleteIOSObject(motionManager)
      return
    }

    plus.ios.invoke(motionManager, 'setGyroUpdateInterval:', watchFrequency / 1000)
    plus.ios.invoke(motionManager, 'startGyroUpdates')

    const runtime = ctx.getRuntime('gyroscope')
    runtime.iosMotionManager = motionManager
    runtime.iosTimer = setInterval(() => {
      const gyroData = plus.ios.invoke(motionManager, 'gyroData')
      if (!gyroData) {
        return
      }

      const rotationRate = plus.ios.invoke(gyroData, 'rotationRate')
      ctx.emit('gyroscope', {
        x: ctx.readIOSNumber(rotationRate, 'x'),
        y: ctx.readIOSNumber(rotationRate, 'y'),
        z: ctx.readIOSNumber(rotationRate, 'z')
      })
      ctx.deleteIOSObject(rotationRate)
      ctx.deleteIOSObject(gyroData)
    }, watchFrequency)

    ctx.setStatus('gyroscope', 'active', 'iOS CoreMotion 监听中')
    ctx.log('iOS CoreMotion 陀螺仪监听已启动')
  } catch (err) {
    ctx.setStatus('gyroscope', 'error', 'iOS CoreMotion 启动失败')
    ctx.log('启动 iOS CoreMotion 陀螺仪失败: ' + ctx.stringifyError(err))
  }
}

export default {
  key: 'gyroscope',

  start(ctx) {
    ctx.setStatus('gyroscope', 'starting', '启动中')

    if (!plus.os) {
      ctx.setStatus('gyroscope', 'error', '无法识别平台')
      return
    }

    if (plus.os.name === 'Android') {
      startAndroidGyroscope(ctx)
      return
    }

    if (plus.os.name === 'iOS') {
      startIOSGyroscope(ctx)
      return
    }

    ctx.setStatus('gyroscope', 'unsupported', '当前平台暂不支持陀螺仪')
    ctx.log('当前平台暂未实现陀螺仪方案')
  },

  stop(ctx) {
    const runtime = ctx.getRuntime('gyroscope')

    try {
      if (plus.os && plus.os.name === 'Android' && runtime.androidSensorManager && runtime.androidListener) {
        runtime.androidSensorManager.unregisterListener(runtime.androidListener)
      }
    } catch (err) {
      ctx.log('停止陀螺仪监听失败: ' + ctx.stringifyError(err))
    }

    if (runtime.iosTimer) {
      clearInterval(runtime.iosTimer)
      runtime.iosTimer = null
    }

    if (runtime.iosMotionManager) {
      try {
        plus.ios.invoke(runtime.iosMotionManager, 'stopGyroUpdates')
      } catch (err) {
        ctx.log('停止 iOS 陀螺仪监听失败: ' + ctx.stringifyError(err))
      }
      ctx.deleteIOSObject(runtime.iosMotionManager)
      runtime.iosMotionManager = null
    }

    ctx.clearRuntime('gyroscope')
  }
}
