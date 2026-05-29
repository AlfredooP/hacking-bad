# BIN NEXT

Plataforma moderna de gestión de contenedores inteligentes.

## Stack

- **Frontend**: Next.js 15 (App Router)
- **API**: Node.js + Express + Prisma
- **IA**: FastAPI (Python)
- **DB**: MySQL 8
- **Proxy**: Nginx

## Inicio rápido

```bash
cp .env.example .env
# Editar .env con secretos reales
docker compose up --build
```

- Web: http://localhost
- API health: http://localhost/api/health
- Usuario demo: `admin@bin.local` / `password123`

### Si el contenedor `api` no arranca

Las tablas `Regiones` / `Zonas` se crean solo con **Prisma** al iniciar la API (no en scripts MySQL init).

1. Ver el error: `docker compose logs api --tail 80`
2. **Desarrollo (borrar datos):** `docker compose down -v` y luego `docker compose up --build`
3. **Conservar datos** (migración fallida P3009 o tablas de un init antiguo):
   ```bash
   docker compose run --rm api npx prisma migrate resolve --applied 20260529120000_zones_regions
   # si la migración quedó a medias sin tablas:
   # docker compose run --rm api npx prisma migrate resolve --rolled-back 20260529120000_zones_regions
   docker compose up --build
   ```

## Estructura

```
apps/web/     Next.js dashboard
apps/api/     Express REST API
apps/ai/      FastAPI clasificación
infra/nginx/  Reverse proxy
firmware/     Sketches Arduino
docs/         Documentación
```

## Desarrollo local (sin Docker)

### API

```bash
cd apps/api
npm install
cp ../../.env.example ../../.env
npx prisma generate
npm run dev
```

### Web

```bash
cd apps/web
npm install
npm run dev
```

### AI

```bash
cd apps/ai
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Migración desde BIN legacy

Ver [docs/migration-phase1.md](docs/migration-phase1.md) y [docs/iot-api.md](docs/iot-api.md).
