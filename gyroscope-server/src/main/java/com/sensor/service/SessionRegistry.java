package com.sensor.service;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

@Service
public class SessionRegistry {

    private final CopyOnWriteArraySet<WebSocketSession> monitorSessions = new CopyOnWriteArraySet<>();
    private final CopyOnWriteArraySet<WebSocketSession> deviceSessions = new CopyOnWriteArraySet<>();

    public void registerMonitor(WebSocketSession session) {
        monitorSessions.add(session);
    }

    public void registerDevice(WebSocketSession session) {
        deviceSessions.add(session);
    }

    public void remove(WebSocketSession session) {
        monitorSessions.remove(session);
        deviceSessions.remove(session);
    }

    public Set<WebSocketSession> getMonitorSessions() {
        return monitorSessions;
    }
}
