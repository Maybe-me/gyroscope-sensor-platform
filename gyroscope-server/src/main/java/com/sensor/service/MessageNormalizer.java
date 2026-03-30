package com.sensor.service;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sensor.adapter.LegacyPayloadAdapter;
import com.sensor.protocol.MessageType;
import com.sensor.protocol.NormalizedMessage;
import org.springframework.stereotype.Service;

@Service
public class MessageNormalizer {

    private final LegacyPayloadAdapter legacyPayloadAdapter;

    public MessageNormalizer(LegacyPayloadAdapter legacyPayloadAdapter) {
        this.legacyPayloadAdapter = legacyPayloadAdapter;
    }

    public NormalizedMessage normalize(String payload) {
        JsonObject root = parse(payload);
        MessageType messageType = detectMessageType(root);

        return switch (messageType) {
            case HEARTBEAT -> new NormalizedMessage(MessageType.HEARTBEAT, normalizeHeartbeat(root));
            case TELEMETRY -> new NormalizedMessage(MessageType.TELEMETRY, normalizeTelemetry(root));
            case CAPABILITY -> new NormalizedMessage(MessageType.CAPABILITY, normalizeCapability(root));
            case STATUS -> new NormalizedMessage(MessageType.STATUS, normalizeStatus(root));
            default -> new NormalizedMessage(MessageType.UNKNOWN, root);
        };
    }

    private JsonObject parse(String payload) {
        JsonElement element = JsonParser.parseString(payload);
        if (element == null || !element.isJsonObject()) {
            throw new IllegalArgumentException("Payload is not a JSON object");
        }
        return element.getAsJsonObject();
    }

    private MessageType detectMessageType(JsonObject root) {
        if (root.has("msgType")) {
            String msgType = getAsString(root, "msgType");
            if ("telemetry".equalsIgnoreCase(msgType)) {
                return MessageType.TELEMETRY;
            }
            if ("heartbeat".equalsIgnoreCase(msgType)) {
                return MessageType.HEARTBEAT;
            }
            if ("capability".equalsIgnoreCase(msgType)) {
                return MessageType.CAPABILITY;
            }
            if ("status".equalsIgnoreCase(msgType)) {
                return MessageType.STATUS;
            }
        }

        if ("heartbeat".equalsIgnoreCase(getAsString(root, "type"))) {
            return MessageType.HEARTBEAT;
        }

        return MessageType.TELEMETRY;
    }

    private JsonObject normalizeTelemetry(JsonObject root) {
        JsonObject normalized = new JsonObject();
        normalized.addProperty("schemaVersion", 2);
        normalized.addProperty("msgType", "telemetry");
        normalized.addProperty("timestamp", getAsLong(root, "timestamp", System.currentTimeMillis()));

        String deviceId = getAsString(root, "deviceId");
        JsonObject device = getAsObject(root, "device");
        if (device != null) {
            normalized.add("device", device.deepCopy());
            if (deviceId == null && device.has("id")) {
                deviceId = getAsString(device, "id");
            }
        } else if (deviceId != null) {
            JsonObject legacyDevice = new JsonObject();
            legacyDevice.addProperty("id", deviceId);
            normalized.add("device", legacyDevice);
        }

        if (deviceId != null) {
            normalized.addProperty("deviceId", deviceId);
        }

        JsonObject sampling = getAsObject(root, "sampling");
        if (sampling != null) {
            normalized.add("sampling", sampling.deepCopy());
        }

        JsonObject sensors = getAsObject(root, "sensors");
        if (sensors == null) {
            sensors = legacyPayloadAdapter.buildSensorsFromLegacy(root);
        } else {
            sensors = sensors.deepCopy();
        }
        normalized.add("sensors", sensors);

        legacyPayloadAdapter.copyLegacyField(normalized, root, sensors, "gyroscope");
        legacyPayloadAdapter.copyLegacyField(normalized, root, sensors, "accelerometer");
        legacyPayloadAdapter.copyLegacyField(normalized, root, sensors, "orientation");
        legacyPayloadAdapter.copyLegacyField(normalized, root, sensors, "temperature");

        return normalized;
    }

    private JsonObject normalizeHeartbeat(JsonObject root) {
        JsonObject normalized = new JsonObject();
        normalized.addProperty("schemaVersion", 2);
        normalized.addProperty("msgType", "heartbeat");
        normalized.addProperty("timestamp", getAsLong(root, "timestamp", System.currentTimeMillis()));

        String deviceId = getAsString(root, "deviceId");
        JsonObject device = getAsObject(root, "device");
        if (device != null) {
            normalized.add("device", device.deepCopy());
            if (deviceId == null && device.has("id")) {
                deviceId = getAsString(device, "id");
            }
        } else if (deviceId != null) {
            JsonObject legacyDevice = new JsonObject();
            legacyDevice.addProperty("id", deviceId);
            normalized.add("device", legacyDevice);
        }

        if (deviceId != null) {
            normalized.addProperty("deviceId", deviceId);
        }

        return normalized;
    }

    private JsonObject normalizeCapability(JsonObject root) {
        JsonObject normalized = normalizeBaseMessage(root, "capability");
        JsonObject sensors = getAsObject(root, "sensors");
        normalized.add("sensors", sensors != null ? sensors.deepCopy() : new JsonObject());
        return normalized;
    }

    private JsonObject normalizeStatus(JsonObject root) {
        JsonObject normalized = normalizeBaseMessage(root, "status");
        JsonObject sensors = getAsObject(root, "sensors");
        normalized.add("sensors", sensors != null ? sensors.deepCopy() : new JsonObject());
        return normalized;
    }

    private JsonObject normalizeBaseMessage(JsonObject root, String msgType) {
        JsonObject normalized = new JsonObject();
        normalized.addProperty("schemaVersion", 2);
        normalized.addProperty("msgType", msgType);
        normalized.addProperty("timestamp", getAsLong(root, "timestamp", System.currentTimeMillis()));

        String deviceId = getAsString(root, "deviceId");
        JsonObject device = getAsObject(root, "device");
        if (device != null) {
            normalized.add("device", device.deepCopy());
            if (deviceId == null && device.has("id")) {
                deviceId = getAsString(device, "id");
            }
        } else if (deviceId != null) {
            JsonObject legacyDevice = new JsonObject();
            legacyDevice.addProperty("id", deviceId);
            normalized.add("device", legacyDevice);
        }

        if (deviceId != null) {
            normalized.addProperty("deviceId", deviceId);
        }

        return normalized;
    }

    private JsonObject getAsObject(JsonObject root, String key) {
        JsonElement element = root.get(key);
        return element != null && element.isJsonObject() ? element.getAsJsonObject() : null;
    }

    private String getAsString(JsonObject root, String key) {
        JsonElement element = root.get(key);
        return element != null && !element.isJsonNull() ? element.getAsString() : null;
    }

    private long getAsLong(JsonObject root, String key, long fallback) {
        JsonElement element = root.get(key);
        return element != null && !element.isJsonNull() ? element.getAsLong() : fallback;
    }
}
