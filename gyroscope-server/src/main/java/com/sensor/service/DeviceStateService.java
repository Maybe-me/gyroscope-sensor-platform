package com.sensor.service;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sensor.protocol.MessageType;
import com.sensor.protocol.NormalizedMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DeviceStateService {

    private static final Logger log = LoggerFactory.getLogger(DeviceStateService.class);
    private static final Gson gson = new Gson();

    private final Map<String, JsonObject> latestCapabilities = new ConcurrentHashMap<>();
    private final Map<String, JsonObject> latestStatuses = new ConcurrentHashMap<>();

    public void remember(NormalizedMessage message) {
        String deviceId = extractDeviceId(message.payload());
        if (deviceId == null) {
            return;
        }

        if (message.messageType() == MessageType.CAPABILITY) {
            latestCapabilities.put(deviceId, message.payload().deepCopy());
        } else if (message.messageType() == MessageType.STATUS) {
            latestStatuses.put(deviceId, message.payload().deepCopy());
        }
    }

    public void replayToMonitor(WebSocketSession session) {
        replayMap(session, latestCapabilities);
        replayMap(session, latestStatuses);
    }

    private void replayMap(WebSocketSession session, Map<String, JsonObject> messages) {
        for (JsonObject payload : messages.values()) {
            if (!session.isOpen()) {
                return;
            }
            try {
                session.sendMessage(new TextMessage(gson.toJson(payload)));
            } catch (IOException e) {
                log.error("向监控端回放设备状态失败: {}", session.getId(), e);
                return;
            }
        }
    }

    private String extractDeviceId(JsonObject payload) {
        if (payload == null) {
            return null;
        }
        if (payload.has("deviceId") && !payload.get("deviceId").isJsonNull()) {
            return payload.get("deviceId").getAsString();
        }
        if (payload.has("device") && payload.get("device").isJsonObject()) {
            JsonObject device = payload.getAsJsonObject("device");
            if (device.has("id") && !device.get("id").isJsonNull()) {
                return device.get("id").getAsString();
            }
        }
        return null;
    }
}
