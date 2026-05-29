/*
  BIN NEXT - ESP32 Bluetooth Classic Firmware with Mock Testing Fallback
  
  This sketch reads data from the connected sensors (DHT22, VL53L0X, HX711)
  and transmits them as a JSON string over Bluetooth Serial.
  
  TESTING FALLBACK:
  - If any sensor is disconnected or returns an invalid value (NaN/timeout/not ready),
    the firmware automatically falls back to generating realistic, randomized mock data.
  - You can also force mock data generation by defining FORCE_MOCK_DATA below.
*/

#include "DHT.h"
#include "HX711.h"
#include "BluetoothSerial.h"
#include <Wire.h>
#include <VL53L0X.h>

// --- Configuration ---
#define SENSOR_ID 1             // The target Sensor ID in the database (e.g., 1 for Contenedor 1)
#define TRANSMIT_INTERVAL 5000   // Send reading every 5 seconds (5000 ms)
#define FORCE_MOCK_DATA 0        // Set to 1 to bypass physical sensors and force mock data for tests

// Pins Definition
#define DHTPIN 18    
#define DHTTYPE DHT22   // DHT 22  

// HX711 Weight Scale Pins
const int LOADCELL_A_DOUT = 16;
const int LOADCELL_A_SCK = 4;

// Initialize classes
DHT dht(DHTPIN, DHTTYPE);
VL53L0X sensor;
HX711 scale1;
BluetoothSerial SerialBT;

// Timing variables
unsigned long tiempoAnterior = 0;
bool dhtInitialized = false;
bool sensorVLInitialized = false;
bool scaleInitialized = false;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("--- BIN NEXT SETUP START ---");

  // Initialize Bluetooth Classic
  // The device name will show up as "ESP32_Contenedor_BIN" in your PC's Bluetooth settings
  if (!SerialBT.begin("ESP32_Contenedor_BIN")) {
    Serial.println("Error al iniciar Bluetooth!");
  } else {
    Serial.println("Bluetooth listo! Empareja con 'ESP32_Contenedor_BIN'");
  }

  // Initialize physical DHT sensor
  #if !FORCE_MOCK_DATA
    dht.begin();
    dhtInitialized = true;
    Serial.println("Sensor DHT22 inicializado.");
  #endif

  // Initialize physical HX711 scale
  #if !FORCE_MOCK_DATA
    scale1.begin(LOADCELL_A_DOUT, LOADCELL_A_SCK);
    scale1.set_scale(13133);
    scale1.tare();
    scaleInitialized = true;
    Serial.println("Celda de carga HX711 inicializada.");
  #endif

  // Initialize physical VL53L0X sensor
  #if !FORCE_MOCK_DATA
    Wire.begin(21, 22);
    sensor.setTimeout(500);
    if (sensor.init()) {
      sensorVLInitialized = true;
      sensor.setSignalRateLimit(0.1);
      sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodPreRange, 18);
      sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodFinalRange, 14);
      Serial.println("Sensor VL53L0X infrarrojo inicializado.");
    } else {
      Serial.println("VL53L0X no detectado. Se usará simulación.");
    }
  #endif

  // Seed random generator
  randomSeed(analogRead(0));
  Serial.println("--- SETUP COMPLETED ---");
}

void loop() {
  unsigned long tiempoActual = millis();

  if (tiempoActual - tiempoAnterior >= TRANSMIT_INTERVAL) {
    tiempoAnterior = tiempoActual;

    float t = 0.0;
    float h = 0.0;
    float distanciaCalibrada = 0.0;
    float peso = 0.0;

    bool useMock = FORCE_MOCK_DATA;

    // --- 1. Temperature & Humidity ---
    if (!useMock && dhtInitialized) {
      t = dht.readTemperature();
      h = dht.readHumidity();
      if (isnan(t) || isnan(h)) {
        Serial.println("DHT22 Leyó NaN. Usando datos simulados...");
        t = 20.0 + random(0, 1500) / 100.0; // Random temperature between 20C and 35C
        h = 40.0 + random(0, 3000) / 100.0; // Random humidity between 40% and 70%
      }
    } else {
      // Simulation values
      t = 22.5 + random(-300, 300) / 100.0; // Steady temp around 22.5C
      h = 55.0 + random(-800, 800) / 100.0; // Steady humidity around 55%
    }

    // --- 2. Distance VL53L0X (Fill depth) ---
    if (!useMock && sensorVLInitialized) {
      int distancia = sensor.readRangeSingleMillimeters();
      distanciaCalibrada = distancia / 10.0; // mm to cm
      if (sensor.timeoutOccurred() || distancia > 8000) {
        Serial.println("Sensor VL53L0X falló. Usando nivel simulado...");
        distanciaCalibrada = 5.0 + random(0, 9500) / 100.0; // Random fill distance between 5cm and 100cm
      }
    } else {
      // Simulate slow fill up: random value between 5cm (completely full) and 80cm (empty)
      distanciaCalibrada = 10.0 + random(0, 7000) / 100.0;
    }

    // --- 3. Weight HX711 ---
    if (!useMock && scaleInitialized && scale1.is_ready()) {
      peso = scale1.get_units(5); // Average of 5 readings
      if (peso < 0) peso = 0.0;
    } else {
      // Simulate weight corresponding logically to the fill depth:
      // A smaller distance (distanciaCalibrada) means more trash, hence higher weight
      float fillFactor = (80.0 - distanciaCalibrada) / 80.0;
      if (fillFactor < 0) fillFactor = 0;
      peso = fillFactor * 25.0 + random(0, 200) / 100.0; // Max simulated weight around 25kg
    }

    // --- 4. Package & Transmit ---
    // Format JSON payload as expected by standard BIN NEXT REST API
    String jsonPayload = "{";
    jsonPayload += "\"id_sensor\":" + String(SENSOR_ID) + ",";
    jsonPayload += "\"tempCelsius\":" + String(t, 2) + ",";
    jsonPayload += "\"humedad\":" + String(h, 2) + ",";
    jsonPayload += "\"distanciaBoteTapa\":" + String(distanciaCalibrada, 2) + ",";
    jsonPayload += "\"pesoKg\":" + String(peso, 2);
    jsonPayload += "}";

    // Print to PC via physical USB Serial for debugging
    Serial.print("USB Serial: ");
    Serial.println(jsonPayload);

    // Send over Bluetooth Classic Serial
    if (SerialBT.hasClient()) {
      SerialBT.println(jsonPayload);
      Serial.println("-> Transmitido con éxito vía Bluetooth!");
    } else {
      Serial.println("-> Bluetooth desconectado. Esperando a que el PC o puente se conecte...");
    }
  }
}
