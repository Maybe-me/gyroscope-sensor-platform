package com.sensor.config;

import com.sensor.handler.SensorWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final SensorWebSocketHandler sensorHandler;

    public WebSocketConfig(SensorWebSocketHandler sensorHandler) {
        this.sensorHandler = sensorHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(sensorHandler, "/ws/sensor", "/ws/monitor")
                .setAllowedOrigins("*");
    }
}