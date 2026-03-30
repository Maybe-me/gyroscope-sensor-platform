package com.sensor.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;

@Service
public class Broadcaster {

    private static final Logger log = LoggerFactory.getLogger(Broadcaster.class);

    private final SessionRegistry sessionRegistry;

    public Broadcaster(SessionRegistry sessionRegistry) {
        this.sessionRegistry = sessionRegistry;
    }

    public void broadcastToMonitors(String data) {
        TextMessage message = new TextMessage(data);
        for (WebSocketSession session : sessionRegistry.getMonitorSessions()) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(message);
                } catch (IOException e) {
                    log.error("发送数据到前端失败: {}", session.getId(), e);
                }
            }
        }
    }
}
