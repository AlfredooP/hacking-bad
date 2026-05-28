# Firmware BIN

Migrar aquí los sketches Arduino desde el proyecto legacy:

- `sketch_full_V1.0.ino`
- `sketch_full_V1.2`

## Cambios requeridos para BIN NEXT

1. Endpoint HTTP: `POST /api/v1/iot/readings`
2. Header: `X-API-Key: <IOT_API_KEY>`
3. Cuerpo JSON con `id_sensor`, `tempCelsius`, `humedad`, `distanciaBoteTapa`, `pesoKg`

Ver [docs/iot-api.md](../docs/iot-api.md).
