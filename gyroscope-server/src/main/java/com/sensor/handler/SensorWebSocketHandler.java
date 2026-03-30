package com.sensor.handler;

import com.google.gson.Gson;
import com.sensor.protocol.MessageType;
import com.sensor.protocol.NormalizedMessage;
import com.sensor.service.Broadcaster;
import com.sensor.service.DeviceStateService;
import com.sensor.service.MessageNormalizer;
import com.sensor.service.SessionRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class SensorWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(SensorWebSocketHandler.class);
    private static final Gson gson = new Gson();

    private final SessionRegistry sessionRegistry;
    private final MessageNormalizer messageNormalizer;
    private final Broadcaster broadcaster;
    private final DeviceStateService deviceStateService;

    public SensorWebSocketHandler(SessionRegistry sessionRegistry,
                                  MessageNormalizer messageNormalizer,
                                  Broadcaster broadcaster,
                                  DeviceStateService deviceStateService) {
        this.sessionRegistry = sessionRegistry;
        this.messageNormalizer = messageNormalizer;
        this.broadcaster = broadcaster;
        this.deviceStateService = deviceStateService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String path = session.getUri().getPath();
        if (path.contains("/ws/monitor")) {
            sessionRegistry.registerMonitor(session);
            log.info("前端监控页面已连接: {}", session.getId());
            deviceStateService.replayToMonitor(session);
        } else if (path.contains("/ws/sensor")) {
            sessionRegistry.registerDevice(session);
            log.info("传感器设备已连接: {}", session.getId());
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();
        log.debug("收到原始数据: {}", payload);

        try {
            NormalizedMessage normalized = messageNormalizer.normalize(payload);

            if (normalized.messageType() == MessageType.HEARTBEAT) {
                log.debug("收到心跳消息: {}", gson.toJson(normalized.payload()));
                return;
            }

            if (normalized.messageType() == MessageType.UNKNOWN) {
                log.warn("忽略未知消息类型: {}", payload);
                return;
            }

            if (normalized.messageType() == MessageType.CAPABILITY || normalized.messageType() == MessageType.STATUS) {
                deviceStateService.remember(normalized);
            }

            String jsonOutput = gson.toJson(normalized.payload());
            broadcaster.broadcastToMonitors(jsonOutput);

        } catch (Exception e) {
            log.error("数据解析失败: {}", payload, e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessionRegistry.remove(session);
        log.info("连接已关闭: {}", session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("传输错误: {}", session.getId(), exception);
        sessionRegistry.remove(session);
    }
}
