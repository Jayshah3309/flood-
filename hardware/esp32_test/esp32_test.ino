/*
  Flood Prediction & Monitoring System - ESP32 API connectivity test

  This sketch only verifies ESP32 -> WiFi -> FastAPI communication.
  Replace the WiFi credentials and backend IP before uploading.
  No physical ultrasonic sensor, GPS, or LoRa hardware is used yet.
*/

#include <WiFi.h>
#include <HTTPClient.h>

// Replace these placeholders with your local WiFi credentials.
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Replace this with the LAN IP address of the computer running FastAPI.
const char* SENSOR_API_URL = "http://192.168.1.100:8000/api/sensor-data";

// Sample values for the API connectivity test.
const float WATER_LEVEL = 2.45;  // metres
const float RAINFALL = 18.5;     // mm/hour
const float TEMPERATURE = 29.2;  // degrees Celsius
const float LATITUDE = 19.0760;  // GPS latitude
const float LONGITUDE = 72.8777; // GPS longitude

const unsigned long SEND_INTERVAL_MS = 15000;
unsigned long lastSendAt = 0;

void connectToWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.printf("\nWiFi connected. ESP32 IP: %s\n", WiFi.localIP().toString().c_str());
}

void sendSampleReading() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    connectToWiFi();
  }

  HTTPClient http;
  http.begin(SENSOR_API_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"water_level\":" + String(WATER_LEVEL, 2) + ",";
  payload += "\"rainfall\":" + String(RAINFALL, 1) + ",";
  payload += "\"temperature\":" + String(TEMPERATURE, 1) + ",";
  payload += "\"latitude\":" + String(LATITUDE, 4) + ",";
  payload += "\"longitude\":" + String(LONGITUDE, 4);
  payload += "}";

  Serial.println("POST " + String(SENSOR_API_URL));
  Serial.println("Payload: " + payload);

  const int httpCode = http.POST(payload);
  if (httpCode > 0) {
    Serial.printf("HTTP status: %d\n", httpCode);
    Serial.println("Response: " + http.getString());
  } else {
    Serial.printf("HTTP request failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  connectToWiFi();
  sendSampleReading();
  lastSendAt = millis();
}

void loop() {
  if (millis() - lastSendAt >= SEND_INTERVAL_MS) {
    sendSampleReading();
    lastSendAt = millis();
  }
}
