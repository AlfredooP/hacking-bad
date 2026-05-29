# API IoT — Contrato para Firmware

## Endpoint

```
POST /api/v1/iot/readings
```

## Autenticación

Header obligatorio:

```
X-API-Key: <IOT_API_KEY>
```

El valor debe coincidir con la variable de entorno `IOT_API_KEY` del servicio API.

## Cuerpo (JSON)

```json
{
  "id_sensor": 1,
  "tempCelsius": 27.5,
  "humedad": 55.2,
  "distanciaBoteTapa": 24.0,
  "pesoKg": 1.3
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| id_sensor | int | sí | ID del sensor en tabla `Sensores` |
| tempCelsius | float | no | Temperatura °C |
| humedad | float | no | Humedad % |
| densidad | float | no | Densidad g/cm³ (usada para inferir tipo de residuo) |
| distanciaBoteTapa | float | no | Distancia en cm (valores 819, 6553.5 se descartan) |
| pesoKg | float | no | Peso en kg |

## Respuesta exitosa

```json
HTTP 201
{
  "id_lectura": 64,
  "message": "Reading stored"
}
```

## Errores

| Código | Causa |
|--------|-------|
| 401 | API key inválida |
| 400 | Payload inválido |
| 404 | Sensor no existe |

## Ejemplo Arduino / HTTP Client

```cpp
// POST a http://<servidor>/api/v1/iot/readings
// Header: X-API-Key: tu-clave
// Body JSON con id_sensor y lecturas
```

## Migración desde BIN legacy

Si el firmware apuntaba a un script PHP (`guardar_lectura.php`), actualizar URL y añadir header `X-API-Key`. El cuerpo JSON puede mantener los mismos nombres de campo.
