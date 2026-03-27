package com.sensor.model;

import lombok.Data;

@Data
public class SensorData {
    private String deviceId;
    private long timestamp;
    private AxisData gyroscope;
    private AxisData accelerometer;
    private OrientationData orientation;

    @Data
    public static class AxisData {
        private double x;
        private double y;
        private double z;
    }

    @Data
    public static class OrientationData {
        private double alpha;
        private double beta;
        private double gamma;
    }
}