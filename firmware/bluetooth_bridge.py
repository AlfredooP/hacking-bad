#!/usr/bin/env python3
"""
BIN NEXT - Bluetooth Serial-to-API Bridge Helper Script

This script establishes a connection to the ESP32 via its virtual Bluetooth COM port,
reads the incoming JSON telemetry data, and forwards it to the local Next.js/Docker API.

Requirements:
  pip install pyserial requests

Usage:
  python bluetooth_bridge.py --port COM4 --url http://localhost/api/v1/iot/readings --key dev-iot-api-key-change-me
"""

import argparse
import json
import sys
import time
import requests
import serial

def main():
    parser = argparse.ArgumentParser(description="BIN NEXT - Bluetooth Serial to API Ingestion Bridge")
    parser.add_argument(
        "--port",
        type=str,
        required=True,
        help="The virtual Bluetooth COM port assigned to the ESP32 (e.g., COM3, COM4, /dev/tty.ESP32_Contenedor_BIN)",
    )
    parser.add_argument(
        "--baud",
        type=int,
        default=115200,
        help="Baud rate for serial connection (default: 115200)",
    )
    parser.add_argument(
        "--url",
        type=str,
        default="http://localhost/api/v1/iot/readings",
        help="The endpoint URL of the target Ingestion API (default: http://localhost/api/v1/iot/readings)",
    )
    parser.add_argument(
        "--key",
        type=str,
        default="dev-iot-api-key-change-me",
        help="The IOT_API_KEY authorization token (default: dev-iot-api-key-change-me)",
    )

    args = parser.parse_args()

    print("====================================================")
    print("      BIN NEXT - BLUETOOTH Telemetry Bridge")
    print("====================================================")
    print(f"Puerto COM:    {args.port}")
    print(f"Baud Rate:     {args.baud}")
    print(f"Endpoint API:  {args.url}")
    print(f"API Key:       {args.key[:6]}...")
    print("====================================================")

    try:
        print(f"Intentando abrir el puerto {args.port}...")
        ser = serial.Serial(args.port, args.baud, timeout=2)
        # Flush buffers
        ser.reset_input_buffer()
        print("¡Conectado! Escuchando tramas de datos del ESP32...")
    except serial.SerialException as e:
        print(f"\n[ERROR] No se pudo abrir el puerto {args.port}. Verifique que:")
        print("  1. El ESP32 esté encendido y emparejado vía Bluetooth en su sistema.")
        print(f"  2. El puerto '{args.port}' sea el correcto (compruébelo en Administrador de Dispositivos -> Puertos COM).")
        print("  3. Ningún otro programa (como Arduino IDE Serial Monitor) tenga abierto el puerto.")
        print(f"Detalle del error: {e}")
        sys.exit(1)

    headers = {
        "Content-Type": "application/json",
        "x-api-key": args.key,
    }

    try:
        while True:
            if ser.in_waiting > 0:
                try:
                    # Read single line from Bluetooth serial port
                    line = ser.readline().decode("utf-8").strip()
                    if not line:
                        continue

                    print(f"\n[Recibido BT] RAW: {line}")

                    # Verify it is valid JSON
                    payload = json.loads(line)
                    
                    # Ensure required fields exist or check structure
                    if "id_sensor" not in payload:
                        print("  [ADVERTENCIA] JSON omitido: No contiene 'id_sensor'")
                        continue

                    print(f"  -> Reenviando Lectura de Sensor #{payload['id_sensor']}...")

                    # POST request to Docker local API
                    response = requests.post(args.url, json=payload, headers=headers, timeout=5)

                    if response.status_code == 201:
                        print(f"  [ÉXITO API] Datos guardados en BD! Respuesta: {response.json()}")
                    else:
                        print(f"  [FALLO API] Error HTTP {response.status_code}: {response.text}")

                except json.JSONDecodeError:
                    print("  [ERROR DE TRAMA] Los datos recibidos no son JSON válidos. Omitiendo...")
                except requests.exceptions.RequestException as req_err:
                    print(f"  [ERROR CONEXIÓN API] No se pudo conectar al servidor API: {req_err}")
                except Exception as ex:
                    print(f"  [ERROR INESPERADO] {ex}")

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n\n[INFO] Cerrando puente Bluetooth. ¡Hasta luego!")
    finally:
        ser.close()

if __name__ == "__main__":
    main()
