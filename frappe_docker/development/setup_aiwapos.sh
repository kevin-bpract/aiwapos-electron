#!/usr/bin/env bash
# Bring up an Aiwa POS dev site from zero.
# Run *inside* the dev container at /workspace/development.
set -euo pipefail

SITE="${SITE:-aiwapos.localhost}"
ADMIN_PW="${ADMIN_PW:-admin}"
DB_ROOT_PW="${DB_ROOT_PW:-123}"

echo "▶ Initializing bench (if needed)..."
if [ ! -d "frappe-bench" ]; then
  bench init --skip-redis-config-generation --frappe-branch version-15 frappe-bench
fi
cd frappe-bench

echo "▶ Adding apps to bench..."
[ -d apps/erpnext ] || bench get-app --branch version-15 erpnext https://github.com/frappe/erpnext.git
[ -d apps/pos_api ] || bench get-app /workspace/development/apps/pos_api

echo "▶ Creating site $SITE..."
if [ ! -d "sites/$SITE" ]; then
  bench new-site "$SITE" \
    --admin-password "$ADMIN_PW" \
    --mariadb-root-password "$DB_ROOT_PW" \
    --no-mariadb-socket
fi

echo "▶ Installing apps on $SITE..."
bench --site "$SITE" install-app erpnext
bench --site "$SITE" install-app pos_api

echo "▶ Seeding demo data..."
bench --site "$SITE" execute pos_api.seed.seed_demo.run

echo "▶ Adding site to hosts (manual step on host machine):"
echo "    echo '127.0.0.1  $SITE' | sudo tee -a /etc/hosts"

echo "▶ Run \`bench start\` to launch the server on :8000."
