package com.sensor.adapter;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.springframework.stereotype.Component;

@Component
public class LegacyPayloadAdapter {

    public JsonObject buildSensorsFromLegacy(JsonObject root) {
        JsonObject sensors = new JsonObject();
        addLegacySensor(sensors, root, "gyroscope", "rad/s");
        addLegacySensor(sensors, root, "accelerometer", "m/s²");
        addLegacySensor(sensors, root, "orientation", "°");
        addLegacySensor(sensors, root, "temperature", "°C");
        return sensors;
    }

    public void copyLegacyField(JsonObject normalized, JsonObject root, JsonObject sensors, String key) {
        JsonObject existing = getAsObject(root, key);
        if (existing != null) {
            normalized.add(key, existing.deepCopy());
            return;
        }

        JsonObject sensor = getAsObject(sensors, key);
        if (sensor == null) {
            return;
        }

        JsonObject values = getAsObject(sensor, "values");
        if (values == null) {
            return;
        }

        JsonObject legacy = values.deepCopy();
        JsonObject meta = getAsObject(sensor, "meta");
        if ("temperature".equals(key) && meta != null && meta.has("source")) {
            legacy.add("source", meta.get("source").deepCopy());
        }

        normalized.add(key, legacy);
    }

    private void addLegacySensor(JsonObject sensors, JsonObject root, String key, String unit) {
        JsonObject legacy = getAsObject(root, key);
        if (legacy == null) {
            return;
        }

        JsonObject sensor = new JsonObject();
        sensor.addProperty("type", key);
        sensor.addProperty("status", "active");

        JsonObject values = legacy.deepCopy();
        JsonObject meta = new JsonObject();
        meta.addProperty("unit", unit);

        if ("temperature".equals(key) && values.has("source")) {
            meta.add("source", values.get("source").deepCopy());
            values.remove("source");
        }

        sensor.add("values", values);
        if (meta.size() > 0) {
            sensor.add("meta", meta);
        }

        sensors.add(key, sensor);
    }

    private JsonObject getAsObject(JsonObject root, String key) {
        JsonElement element = root.get(key);
        return element != null && element.isJsonObject() ? element.getAsJsonObject() : null;
    }
}
