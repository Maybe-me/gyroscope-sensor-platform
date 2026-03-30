export default {
  key: 'orientation',

  start(ctx) {
    ctx.setStatus('orientation', 'starting', '启动中')
    try {
      const runtime = ctx.getRuntime('orientation')
      runtime.watchId = plus.orientation.watchOrientation(
        (res) => {
          ctx.emit('orientation', {
            alpha: Number(res.alpha || 0),
            beta: Number(res.beta || 0),
            gamma: Number(res.gamma || 0)
          })
        },
        (err) => {
          ctx.log('方向传感器监听失败: ' + ctx.stringifyError(err))
        },
        { frequency: ctx.getWatchFrequency(ctx.frequency) }
      )

      ctx.setStatus('orientation', 'active', '5+ 监听中')
      ctx.log('5+ 方向传感器监听已启动')
    } catch (err) {
      ctx.setStatus('orientation', 'error', '启动失败')
      ctx.log('启动方向传感器失败: ' + ctx.stringifyError(err))
    }
  },

  stop(ctx) {
    const runtime = ctx.getRuntime('orientation')

    try {
      if (runtime.watchId !== null && plus.orientation && plus.orientation.clearWatch) {
        plus.orientation.clearWatch(runtime.watchId)
      }
    } catch (err) {
      ctx.log('停止方向传感器监听失败: ' + ctx.stringifyError(err))
    } finally {
      runtime.watchId = null
    }

    ctx.clearRuntime('orientation')
  }
}
