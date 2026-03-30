export default {
  key: 'accelerometer',

  start(ctx) {
    ctx.setStatus('accelerometer', 'starting', '启动中')
    try {
      const runtime = ctx.getRuntime('accelerometer')
      runtime.watchId = plus.accelerometer.watchAcceleration(
        (res) => {
          ctx.emit('accelerometer', {
            x: Number(res.xAxis || 0),
            y: Number(res.yAxis || 0),
            z: Number(res.zAxis || 0)
          })
        },
        (err) => {
          ctx.log('加速度计监听失败: ' + ctx.stringifyError(err))
        },
        { frequency: ctx.getWatchFrequency(ctx.frequency) }
      )

      ctx.setStatus('accelerometer', 'active', '5+ 监听中')
      ctx.log('5+ 加速度计监听已启动')
    } catch (err) {
      ctx.setStatus('accelerometer', 'error', '启动失败')
      ctx.log('启动加速度计失败: ' + ctx.stringifyError(err))
    }
  },

  stop(ctx) {
    const runtime = ctx.getRuntime('accelerometer')

    try {
      if (runtime.watchId !== null && plus.accelerometer && plus.accelerometer.clearWatch) {
        plus.accelerometer.clearWatch(runtime.watchId)
      }
    } catch (err) {
      ctx.log('停止加速度计监听失败: ' + ctx.stringifyError(err))
    } finally {
      runtime.watchId = null
    }

    ctx.clearRuntime('accelerometer')
  }
}
