package com.sensor.handler;

import com.google.gson.Gson;
import com.sensor.model.SensorData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class SensorWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(SensorWebSocketHandler.class);
    private static final Gson gson = new Gson();

    private final CopyOnWriteArraySet<WebSocketSession> monitorSessions = new CopyOnWriteArraySet<>();
    private final CopyOnWriteArraySet<WebSocketSession> deviceSessions = new CopyOnWriteArraySet<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String path = session.getUri().getPath();
        if (path.contains("/ws/monitor")) {
            monitorSessions.add(session);
            log.info("前端监控页面已连接: {}", session.getId());
        } else if (path.contains("/ws/sensor")) {
            deviceSessions.add(session);
            log.info("传感器设备已连接: {}", session.getId());
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();
        log.debug("收到原始数据: {}", payload);

        try {
            SensorData sensorData = gson.fromJson(payload, SensorData.class);

            if (sensorData.getTimestamp() == 0) {
                sensorData.setTimestamp(System.currentTimeMillis());
            }

            String jsonOutput = gson.toJson(sensorData);
            broadcastToMonitors(jsonOutput);

        } catch (Exception e) {
            log.error("数据解析失败: {}", payload, e);
        }
    }

    private void broadcastToMonitors(String data) {
        TextMessage message = new TextMessage(data);
        for (WebSocketSession session : monitorSessions) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(message);
                } catch (IOException e) {
                    log.error("发送数据到前端失败: {}", session.getId(), e);
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        monitorSessions.remove(session);
        deviceSessions.remove(session);
        log.info("连接已关闭: {}", session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("传输错误: {}", session.getId(), exception);
        monitorSessions.remove(session);
        deviceSessions.remove(session);
    }
}