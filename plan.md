# gyroscope-sensor-platform 架构规划

## 问题与目标

当前 `E:\myLife\gyroscope-sensor-platform` 下包含 3 个项目：

- `gyroscope-collector`：uni-app 采集端
- `gyroscope-server`：Java WebSocket 转发后端
- `gyroscope-monitor`：Web 监控前端

现状能够工作，但三端都围绕固定字段（`gyroscope`、`accelerometer`、`orientation`、`temperature`）直接写死，导致每新增一个传感器，都需要同时修改：

- 采集端页面状态与发送 payload
- 后端 Java 模型
- 前端卡片、图表、表格和解析逻辑

目标是在不推翻现有项目的前提下，建立一个“后续持续新增不同传感器”的可扩展架构。

## 当前进展

- 已完成 P0 第一阶段落地：
  - collector 已发送 `schemaVersion + msgType + sensors`
  - server 已识别 `heartbeat / telemetry`，并做 V1/V2 规范化
  - monitor 已兼容 V1/V2，并忽略 heartbeat 对图表和表格的污染
- 已完成 P1 第一阶段落地：
  - server 已拆出 `LegacyPayloadAdapter`
  - server 已拆出 `MessageNormalizer`
  - server 已拆出 `SessionRegistry` 与 `Broadcaster`
  - `SensorWebSocketHandler` 已收敛为薄路由层
- 已完成 P2 第一阶段落地：
  - collector 已抽出 `utils\sensors\state.js` 统一管理传感器值与状态
  - collector 已抽出 `utils\sensors\reporter.js` 统一按频率快照上报
  - `index.vue` 已改为消费 `sensorState + TelemetryReporter`
- 已完成 P3 第一阶段落地：
  - `utils\appSensors.js` 已收敛为 facade/orchestrator
  - collector 已新增 `utils\sensors\registry.js`
  - gyroscope / accelerometer / orientation / temperature 已拆入 `utils\sensors\adapters\`
- 已完成 P4 第一阶段落地：
  - monitor 已新增 `src\schemas\sensorRegistry.js` 与 builtins schema
  - monitor 已新增 `src\utils\normalizers.js` 与 `src\utils\formatters.js`
  - `SensorMonitor.vue` 已改为由 schema 驱动卡片、曲线和表格列
- 已完成 P5 第一阶段落地：
  - collector 已补充 `capability / status` 协议消息
  - server 已识别并广播 `capability / status`，并对新监控连接回放最近状态
  - monitor 已展示每个传感器的能力状态与运行状态
- 当前仍处于“过渡兼容期”：
  - collector 同时发送 `legacy fields + sensors`
  - server 仍保留 legacy 兼容
  - monitor 同时兼容旧结构与新结构


## 当前职责与主要耦合点

### 1. 采集端 `gyroscope-collector`

当前关键文件：

- `gyroscope-collector\pages\index\index.vue`
- `gyroscope-collector\utils\appSensors.js`
- `gyroscope-collector\utils\websocket.js`

当前问题：

- 页面状态、传感器采集、协议组包耦合在 `index.vue`
- `appSensors.js` 是大而全的单体类，继续加传感器会越来越膨胀
- `sendData()` 发送固定结构 JSON，不利于扩展

### 2. 后端 `gyroscope-server`

当前关键文件：

- `gyroscope-server\src\main\java\com\sensor\handler\SensorWebSocketHandler.java`
- `gyroscope-server\src\main\java\com\sensor\model\SensorData.java`

当前问题：

- 后端不是纯透传，而是 `fromJson -> Java Model -> toJson`
- `SensorData` 是强类型固定结构
- 新增传感器会反复改模型
- `heartbeat` 与 `telemetry` 没有清晰分层

### 3. 前端 `gyroscope-monitor`

当前关键文件：

- `gyroscope-monitor\src\views\SensorMonitor.vue`

当前问题：

- 卡片写死
- 图表写死
- 表格列写死
- WebSocket 数据解析写死

这使得新增传感器时，前端不是“注册配置”，而是“继续改模板和逻辑”。


## 推荐目标架构

总体原则：

1. 保留现有三个项目
2. 保留现有 WebSocket 通道
3. 在协议、采集端抽象、前端渲染方式上增加中间层
4. 过渡期兼容旧结构，避免一次性重写


## 一、协议层：从固定字段升级到统一消息信封

建议引入统一消息结构：

```json
{
  "schemaVersion": 2,
  "msgType": "telemetry",
  "device": {
    "id": "device-id",
    "model": "model-name",
    "platform": "android",
    "appVersion": "1.0.0"
  },
  "timestamp": 1711526400000,
  "sampling": {
    "targetHz": 30
  },
  "sensors": {
    "gyroscope": {
      "type": "gyroscope",
      "status": "active",
      "values": { "x": 0.1, "y": 0.2, "z": 0.3 },
      "meta": { "unit": "rad/s" }
    },
    "temperature": {
      "type": "temperature",
      "status": "active",
      "values": { "celsius": 26.8 },
      "meta": { "source": "battery", "unit": "°C" }
    }
  },
  "gyroscope": { "x": 0.1, "y": 0.2, "z": 0.3 },
  "temperature": { "celsius": 26.8, "source": "battery" }
}
```

### 协议设计原则

- 必须区分 `msgType`
  - `telemetry`
  - `heartbeat`
  - `capability`
  - `status`
- 后端只做信封级校验，不对每个传感器值域做重度绑定
- 为 envelope / device / sensor 预留 `meta` / `ext`
- 过渡期保留旧字段，兼容现有 monitor 和 server


## 二、采集端架构：adapter + registry + state + reporter

### 推荐核心抽象

#### 1. `SensorAdapter`

每个传感器一个适配器，统一接口：

```js
{
  key: 'gyroscope',
  label: '陀螺仪',
  detect(ctx) => capability,
  start(ctx, emit) => void,
  stop() => void
}
```

#### 2. `SensorRegistry`

集中注册内置传感器：

- gyroscope
- accelerometer
- orientation
- temperature

后续新增 `barometer`、`light`、`magnetometer` 时，只需新增 adapter 并注册。

#### 3. 统一运行时状态 `SensorState`

建议收敛成：

```js
state = {
  sensors: {
    gyroscope: {
      status: 'active',
      value: { x: 0, y: 0, z: 0 },
      ts: 1711,
      meta: { unit: 'rad/s', source: 'android.native' }
    }
  }
}
```

这样页面消费 `state.sensors`，而不是维护多套独立字段。

#### 4. 统一上报器 `TelemetryReporter`

保留你现在“按频率快照发送”的思路：

- 各 adapter 实时写入 store
- reporter 按频率 flush 快照

这样兼容现有监控端实时曲线逻辑，也避免事件风暴。

### collector 建议目录

```text
gyroscope-collector/
  pages/
    index/
      index.vue
  utils/
    websocket.js
    protocol/
      envelope.js
      legacyCompat.js
    sensors/
      manager.js
      registry.js
      state.js
      adapters/
        gyroscope.adapter.js
        accelerometer.adapter.js
        orientation.adapter.js
        temperature.adapter.js
      platform/
        app-plus.js
```

### 过渡策略

- 先保留 `utils\appSensors.js`
- 再逐步把逻辑迁到 `utils\sensors\adapters\*`
- 最后让 `appSensors.js` 只作为 facade 或移除


## 三、后端架构：message normalizer + legacy adapter

### 推荐分层

```text
gyroscope-server/
  src/main/java/com/sensor/
    config/
      WebSocketConfig.java
    handler/
      SensorWebSocketHandler.java
    protocol/
      MessageEnvelope.java
      MessageType.java
      TelemetryMessage.java
      HeartbeatMessage.java
      CapabilityMessage.java
      SensorReading.java
    adapter/
      LegacyPayloadAdapter.java
    service/
      MessageNormalizer.java
      SessionRegistry.java
      Broadcaster.java
      DeviceStateService.java
    model/
      SensorData.java
```

### 后端职责调整

- `WebSocketHandler` 不再直接依赖固定传感器字段模型
- 先识别 `msgType`
- 旧结构走 `LegacyPayloadAdapter`
- 新结构走 `MessageNormalizer`
- heartbeat 不进入 telemetry 广播链

### 关键原则

- 后端负责“协议正确”
- 后端不负责“每种传感器都写死 Java 模型”
- 新协议内部建议使用：
  - `Map<String, SensorReading>`
  - 或 `JsonNode`

建议：

- `SensorData.java` 作为 legacy 继续保留
- 新主链路切到 envelope + `Map<String, SensorReading>`


## 四、监控端架构：schema-driven 渲染

### 推荐核心抽象

#### 1. 传感器显示定义 registry

例如：

```js
export default {
  gyroscope: {
    label: '陀螺仪',
    unit: 'rad/s',
    fields: [
      { key: 'x', label: 'X', precision: 4 },
      { key: 'y', label: 'Y', precision: 4 },
      { key: 'z', label: 'Z', precision: 4 }
    ],
    widgets: ['card', 'chart', 'table']
  }
}
```

新增传感器优先加 schema，而不是改主页面。

#### 2. 通用组件

- `SensorValueCard.vue`
- `SensorLineChart.vue`
- `SensorTable.vue`

主页面只负责：

- 订阅 WS
- 维护 store
- 根据 schema 渲染

#### 3. 统一前端 store

建议至少演进到：

```js
devices[deviceId] = {
  latest,
  sensors,
  history
}
```

这样可以：

- 按设备隔离
- 按传感器 key 管理曲线
- heartbeat 只影响在线状态

### monitor 建议目录

```text
gyroscope-monitor/
  src/
    views/
      SensorMonitor.vue
    components/
      sensor/
        SensorValueCard.vue
        SensorLineChart.vue
        SensorTable.vue
    schemas/
      sensorRegistry.js
      builtins/
        gyroscope.js
        accelerometer.js
        orientation.js
        temperature.js
    composables/
      useSensorSocket.js
      useSensorStore.js
    utils/
      normalizers.js
      formatters.js
```

### 过渡策略

- 第一步先不大改页面结构
- 先引入 `schema + store + normalizer`
- 再把表格、卡片、图表逐步改成配置驱动


## 五、新增一个传感器的标准流程

以 `barometer`（气压）为例。

### collector

1. 新增 `utils\sensors\adapters\barometer.adapter.js`
2. 实现：
   - `detect()`
   - `start()`
   - `stop()`
   - 输出 `values: { pressure }`
3. 在 `registry.js` 注册
4. 如需权限，修改 `manifest.json`
5. Reporter 自动上报到 `sensors.barometer`
6. 过渡期如有需要，同时补 legacy 字段 `barometer`

### server

理想情况下不需要改主 handler，只需要：

1. 新协议下，normalizer 自动接收 `sensors.barometer`
2. 如做软校验，加 schema
3. 如兼容旧结构，在 `LegacyPayloadAdapter` 中支持 `barometer`

### monitor

1. 新增 `schemas\builtins\barometer.js`
2. 定义：
   - label
   - unit
   - fields
   - widgets
3. 若通用组件已就绪，主页面无需再改模板


## 六、优先级最高的落地顺序

### P0：先定协议 v2 与兼容策略

先统一：

- `schemaVersion`
- `msgType`
- `device`
- `timestamp`
- `sensors`
- `meta/ext`
- 旧字段兼容策略

### P1：后端先加规范化层

优先做：

- `LegacyPayloadAdapter`
- `MessageNormalizer`
- heartbeat 单独处理

这是当前收益最高的基础改造。

### P2：采集端抽统一状态与统一上报器

先把 `index.vue` 里的：

- 传感器状态
- 传感器值
- sendData 组包

从页面中剥离。

### P3：把 `appSensors.js` 拆成 adapter + registry

先拆现有四个内置传感器，后续新增传感器就不会继续往大文件里堆。

### P4：monitor 引入 schema registry

先做数据 normalize，再做：

- 动态表格列
- 动态卡片
- 动态图表

### P5：补 capability/status 消息

收益：

- monitor 知道设备支持哪些传感器
- UI 能区分 unsupported / unavailable / active
- 新增传感器时更自描述


## 结论

后续要想“方便不断新增不同传感器”，最关键的不是继续给三端加字段，而是做三件基础改造：

1. 协议从固定字段升级到 `envelope + sensors`
2. collector 从单体类升级到 `adapter + registry + state + reporter`
3. monitor 从硬编码页面升级到 `schema-driven` 渲染

过渡期建议：

- collector 同时发 `legacy fields + sensors`
- server 同时支持 `V1 + V2`
- monitor 先兼容旧结构，再逐步切换到新 store

这样后续新增磁场、光照、气压、距离、湿度、电池状态等传感器时，改动会从“三端重写业务逻辑”收敛成“注册传感器 + 补 schema + 少量协议适配”。
