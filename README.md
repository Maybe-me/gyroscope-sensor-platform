# 陀螺仪传感器数据采集平台

> 一个完整的陀螺仪传感器数据采集、传输与实时监控平台，由手机端 UniApp、Java Spring Boot 后端和 Vue 前端监控三部分组成。

---

## 架构图

```
📱 UniApp 手机端 ──WebSocket──► ☕ Java Spring Boot 后端 ──WebSocket──► 🖥️ Vue 前端监控
(gyroscope-collector)              (gyroscope-server)                    (gyroscope-monitor)
```

---

## 模块说明

### ☕ 后端 `gyroscope-server`

基于 **Java Spring Boot** 构建的 WebSocket 服务器，负责接收手机端上报的传感器数据并实时转发给所有监控前端。

- 框架：Spring Boot + Spring WebSocket
- 端口：`8080`
- WebSocket 路径：`/ws/sensor`（手机端上报）、`/ws/monitor`（前端订阅）

### 🖥️ 前端 `gyroscope-monitor`

基于 **Vue 3 + Vite** 构建的实时监控大屏，通过 WebSocket 订阅后端推送的传感器数据，以图表和数值的形式展示。

- 框架：Vue 3 + Vite
- 端口：`5173`（开发模式）

### 📱 手机端 `gyroscope-collector`

基于 **UniApp** 构建的跨平台手机应用，采集设备陀螺仪、加速度计和方向数据，通过 WebSocket 实时上报至后端。

- 框架：UniApp（支持 APP 和 H5）
- APP 端使用 `uni.startGyroscope` / `uni.startAccelerometer` / `uni.startCompass`
- H5 端使用 `devicemotion` / `deviceorientation` 浏览器事件

---

## 数据格式

手机端上报的 JSON 数据格式如下：

```json
{
  "deviceId": "device-model",
  "timestamp": 1711526400000,
  "gyroscope": { "x": 0.0, "y": 0.0, "z": 0.0 },
  "accelerometer": { "x": 0.0, "y": 0.0, "z": 0.0 },
  "orientation": { "alpha": 0.0, "beta": 0.0, "gamma": 0.0 }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `deviceId` | string | 设备型号标识 |
| `timestamp` | number | 采集时间戳（毫秒） |
| `gyroscope.x/y/z` | number | 陀螺仪三轴角速度（rad/s） |
| `accelerometer.x/y/z` | number | 加速度计三轴加速度（m/s²） |
| `orientation.alpha/beta/gamma` | number | 设备方向角（°） |

---

## 快速启动

### 1. 启动后端

```bash
cd gyroscope-server && mvn spring-boot:run
```

后端默认监听 `http://localhost:8080`，WebSocket 地址为 `ws://localhost:8080/ws/sensor`。

### 2. 启动前端监控

```bash
cd gyroscope-monitor && npm install && npm run dev
```

浏览器访问 `http://localhost:5173` 查看实时监控大屏。

### 3. 运行手机端

用 **HBuilderX** 打开 `gyroscope-collector` 目录，选择运行到真机或浏览器（H5 模式）。

---

## 技术栈

| 模块 | 技术 |
|------|------|
| 手机端 | UniApp、Vue 3、WebSocket |
| 后端 | Java 17、Spring Boot 3、Spring WebSocket |
| 前端监控 | Vue 3、Vite、WebSocket |

---

## 注意事项

- **传感器权限**：在 Android/iOS 真机上运行时，需在 `manifest.json` 中声明传感器相关权限，部分 iOS 设备需用户手动授权方向传感器访问。
- **H5 模式**：浏览器出于安全限制，`devicemotion` / `deviceorientation` 事件仅在 **HTTPS** 页面或 `localhost` 下可用。
- **局域网连接**：手机端与后端须处于同一局域网，将服务器地址配置为后端所在机器的局域网 IP。
- **跨域**：后端已配置 WebSocket 跨域支持，前端开发模式下如需 REST 接口请自行配置代理。
