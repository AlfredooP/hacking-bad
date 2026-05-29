#!/bin/sh
set -e

echo "Waiting for MySQL..."
ready=0
for i in $(seq 1 60); do
  if npx prisma db execute --schema=./prisma/schema.prisma --stdin <<'EOF' >/dev/null 2>&1
SELECT 1;
EOF
  then
    ready=1
    echo "MySQL is ready."
    break
  fi
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "MySQL not reachable after 120s"
  exit 1
fi

migrate_out=""
migrate_status=0

run_migrate_deploy() {
  migrate_out=$(npx prisma migrate deploy 2>&1) || true
  if echo "$migrate_out" | grep -q "All migrations have been successfully applied"; then
    migrate_status=0
  elif echo "$migrate_out" | grep -qi "No pending migrations"; then
    migrate_status=0
  elif echo "$migrate_out" | grep -q "P3005"; then
    migrate_status=1
  elif echo "$migrate_out" | grep -qE "Error:|error:"; then
    migrate_status=1
  else
    migrate_status=0
  fi
  echo "$migrate_out"
}

mark_zones_migration_applied() {
  echo "Marking zones migration as applied..."
  npx prisma migrate resolve --applied 20260529120000_zones_regions
}

mark_camion_region_migration_applied() {
  echo "Marking camion_region migration as applied..."
  npx prisma migrate resolve --applied 20260529160000_camion_region || true
}

zones_tables_exist() {
  npx prisma db execute --schema=./prisma/schema.prisma --stdin <<'EOF' 2>/dev/null \
    | tr -d ' \r\n' | grep -q '^1$'
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name = 'Regiones';
EOF
}

camion_region_column_exists() {
  npx prisma db execute --schema=./prisma/schema.prisma --stdin <<'EOF' 2>/dev/null \
    | tr -d ' \r\n' | grep -q '^1$'
SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'Camiones' AND column_name = 'id_region';
EOF
}

echo "Applying Prisma migrations..."
set +e
run_migrate_deploy
set -e

if [ "$migrate_status" -ne 0 ]; then
  if echo "$migrate_out" | grep -q "P3005"; then
    echo "Schema exists from MySQL init — baselining Prisma migrations..."
    npx prisma migrate resolve --applied 20260528000000_init
    npx prisma db execute --schema=./prisma/schema.prisma --file ./prisma/scripts/ensure-extras.sql
    if echo "$migrate_out" | grep -qiE "Duplicate column|already exists"; then
      npx prisma migrate resolve --applied 20260528120000_smart_containers || true
    fi
    if zones_tables_exist; then mark_zones_migration_applied; fi
    set +e
    run_migrate_deploy
    set -e
  elif echo "$migrate_out" | grep -q "P3009"; then
    echo "Recovering failed migration record (P3009)..."
    # Check which migration failed
    if echo "$migrate_out" | grep -q "camion_region"; then
      echo "Resolving camion_region failed migration..."
      if camion_region_column_exists; then
        npx prisma migrate resolve --applied 20260529160000_camion_region || true
      else
        npx prisma migrate resolve --rolled-back 20260529160000_camion_region || true
      fi
    elif zones_tables_exist || echo "$migrate_out" | grep -q "Regiones"; then
      mark_zones_migration_applied
    else
      npx prisma migrate resolve --rolled-back 20260529120000_zones_regions || true
    fi
    set +e
    run_migrate_deploy
    set -e
    if [ "$migrate_status" -ne 0 ] && echo "$migrate_out" | grep -qiE "Regiones.*already exists|1050"; then
      mark_zones_migration_applied
      set +e
      run_migrate_deploy
      set -e
    fi
    if [ "$migrate_status" -ne 0 ] && echo "$migrate_out" | grep -qiE "Duplicate column.*id_region|id_region.*already"; then
      mark_camion_region_migration_applied
      set +e
      run_migrate_deploy
      set -e
    fi
  elif echo "$migrate_out" | grep -qiE "Regiones.*already exists|Table.*Regiones.*already exists|1050|Duplicate column.*id_zone"; then
    echo "Zone schema already exists — marking zones migration applied..."
    mark_zones_migration_applied
    if camion_region_column_exists; then mark_camion_region_migration_applied; fi
    set +e
    run_migrate_deploy
    set -e
  elif echo "$migrate_out" | grep -qiE "Duplicate column.*id_region|id_region.*Duplicate"; then
    echo "Camion id_region column already exists — marking camion_region migration applied..."
    mark_camion_region_migration_applied
    set +e
    run_migrate_deploy
    set -e
  elif echo "$migrate_out" | grep -qiE "Duplicate column|already exists"; then
    echo "Schema drift — resolving smart_containers / zones if needed..."
    npx prisma migrate resolve --applied 20260528120000_smart_containers || true
    if zones_tables_exist; then mark_zones_migration_applied; fi
    if camion_region_column_exists; then mark_camion_region_migration_applied; fi
    set +e
    run_migrate_deploy
    set -e
  fi
fi

if [ "$migrate_status" -ne 0 ]; then
  echo "Prisma migrate deploy failed."
  exit 1
fi

echo "Starting API..."
exec node dist/index.js
