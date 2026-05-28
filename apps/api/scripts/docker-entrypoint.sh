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

echo "Applying Prisma migrations..."
set +e
migrate_out=$(npx prisma migrate deploy 2>&1)
migrate_status=$?
set -e

if [ "$migrate_status" -ne 0 ]; then
  echo "$migrate_out"
  if echo "$migrate_out" | grep -q "P3005"; then
    echo "Schema exists from MySQL init — baselining Prisma migration..."
    npx prisma migrate resolve --applied 20260528000000_init
    npx prisma db execute --schema=./prisma/schema.prisma --file ./prisma/scripts/ensure-extras.sql
    npx prisma migrate deploy
  else
    exit "$migrate_status"
  fi
else
  echo "$migrate_out"
fi

echo "Starting API..."
exec node dist/index.js
