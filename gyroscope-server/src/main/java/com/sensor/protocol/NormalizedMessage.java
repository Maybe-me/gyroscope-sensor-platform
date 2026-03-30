package com.sensor.protocol;

import com.google.gson.JsonObject;

public record NormalizedMessage(MessageType messageType, JsonObject payload) {
}
