# Fase 1 — Migración y convivencia con BIN legacy

## Objetivo

Poner en producción la API Node.js para ingestión IoT mientras el frontend PHP sigue operativo.

## Pasos en la VM

### 1. Clonar BIN NEXT

```bash
git clone <repo-url> /opt/bin-next
cd /opt/bin-next
cp .env.example .env
# Editar secretos: JWT_*, IOT_API_KEY, AI_SERVICE_TOKEN, MYSQL_*
```

### 2. Levantar stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Verificar:

```bash
curl http://localhost/api/health
# {"status":"ok","service":"bin-api"}
```

### 3. Nginx híbrido (PHP + BIN NEXT)

Mientras coexisten ambos sistemas, configurar Nginx del host o un proxy adicional:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:80;  # bin-next nginx interno
}

location / {
    root /var/www/bin-legacy/frontend;
    index index.php;
    # ... config PHP-FPM existente
}
```

O exponer BIN NEXT en subdominio: `api.tudominio.com` → stack Docker.

### 4. Actualizar firmware

- URL: `https://tudominio.com/api/v1/iot/readings`
- Header: `X-API-Key: <clave configurada en .env>`

Ver [iot-api.md](./iot-api.md).

### 5. Base de datos existente

Si ya existe `bin_db` con datos legacy:

1. Hacer backup: `mysqldump bin_db > backup.sql`
2. Ejecutar migración Prisma desde el contenedor API:

```bash
docker compose exec api npx prisma migrate deploy
```

Esto crea `refresh_tokens`, deduplica `ResultadosIA` y añade índice único por contenedor.

### 6. Validación

```bash
curl -X POST http://localhost/api/v1/iot/readings \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $IOT_API_KEY" \
  -d '{"id_sensor":1,"tempCelsius":26,"humedad":60,"distanciaBoteTapa":30,"pesoKg":2}'
```

Comprobar en MySQL: nueva fila en `LecturasSensores` y upsert en `ResultadosIA`.

## Rollback

- Revertir URL del firmware al endpoint PHP
- `docker compose down` (los datos MySQL persisten en volumen `mysql_data`)

## Siguiente fase

Fase 2: activar frontend Next.js en `/` y retirar páginas PHP de login/dashboard gradualmente.
