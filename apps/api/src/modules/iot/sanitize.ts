const MAX_DISTANCE_CM = 500;
const MAX_WEIGHT_KG = 500;
const MIN_TEMP = -20;
const MAX_TEMP = 80;
const MIN_HUMIDITY = 0;
const MAX_HUMIDITY = 100;

/** Sensor error sentinels seen in legacy data (e.g. 819, 6553.5) */
const INVALID_DISTANCE = new Set([819, 819.1, 6553.5, 0]);

export interface RawReading {
  id_sensor?: number;
  tempCelsius?: number | null;
  humedad?: number | null;
  distanciaBoteTapa?: number | null;
  pesoKg?: number | null;
}

export interface SanitizedReading {
  idSensor: number;
  tempCelsius: number | null;
  humedad: number | null;
  distanciaBoteTapa: number | null;
  pesoKg: number | null;
}

export function sanitizeReading(raw: RawReading): SanitizedReading | null {
  if (!raw.id_sensor || raw.id_sensor < 1) return null;

  let dist = raw.distanciaBoteTapa ?? null;
  if (dist !== null) {
    if (INVALID_DISTANCE.has(dist) || dist > MAX_DISTANCE_CM || dist < 0) {
      dist = null;
    }
  }

  let temp = raw.tempCelsius ?? null;
  if (temp !== null && (temp < MIN_TEMP || temp > MAX_TEMP)) temp = null;

  let hum = raw.humedad ?? null;
  if (hum !== null && (hum < MIN_HUMIDITY || hum > MAX_HUMIDITY)) hum = null;

  let peso = raw.pesoKg ?? null;
  if (peso !== null && (peso < -1 || peso > MAX_WEIGHT_KG)) peso = null;

  return {
    idSensor: raw.id_sensor,
    tempCelsius: temp,
    humedad: hum,
    distanciaBoteTapa: dist,
    pesoKg: peso,
  };
}
