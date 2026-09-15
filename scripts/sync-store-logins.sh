#!/usr/bin/env bash
# Copy active ShopKit store login emails into the support desk's known_store_login
# table, so the desk can tell a store owner from a stranger (see src/lib/known-sender.ts).
#
# Runs as the postgres OS user (peer auth) from uplink-support-store-logins.timer.
# FAILS CLOSED: if the tenant list or ANY active store database can't be read, the
# table is left exactly as it was. An empty or partial list would silently turn
# real store owners into "unknown senders".
set -euo pipefail

CANON_DB=counter_dev
DESK_DB=uplink_support
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

mapfile -t TENANTS < <(psql -X -At -v ON_ERROR_STOP=1 -d "$CANON_DB" \
	-c "SELECT slug || '|' || db_name FROM tenant WHERE status = 'active' ORDER BY slug")
if [ "${#TENANTS[@]}" -eq 0 ]; then
	echo "[sync-store-logins] no active tenants returned — leaving known_store_login unchanged" >&2
	exit 1
fi

for row in "${TENANTS[@]}"; do
	slug=${row%%|*}
	dbname=${row#*|}
	# Validate before interpolating into SQL (both come from our own tenant table).
	[[ "$slug" =~ ^[a-z][a-z0-9_]{1,30}$ && "$dbname" =~ ^counter_[a-z0-9_]+$ ]] || {
		echo "[sync-store-logins] unexpected tenant row '$row' — aborting" >&2
		exit 1
	}
	if ! psql -X -v ON_ERROR_STOP=1 -d "$dbname" \
		-c "COPY (SELECT DISTINCT lower(trim(email)), '$slug' FROM \"user\" WHERE is_active AND deleted_at IS NULL AND email LIKE '%@%') TO STDOUT" \
		>>"$TMP"; then
		echo "[sync-store-logins] could not read $dbname — leaving known_store_login unchanged" >&2
		exit 1
	fi
done

rows=$(wc -l <"$TMP")
if [ "$rows" -eq 0 ]; then
	echo "[sync-store-logins] 0 logins across ${#TENANTS[@]} stores — refusing to empty the table" >&2
	exit 1
fi

psql -X -q -v ON_ERROR_STOP=1 -d "$DESK_DB" \
	-c "CREATE TEMP TABLE incoming (email varchar(320), tenant_slug varchar(80))" \
	-c "\\copy incoming FROM '$TMP'" \
	-c "BEGIN; DELETE FROM known_store_login; INSERT INTO known_store_login (email, tenant_slug, synced_at) SELECT DISTINCT email, tenant_slug, now() FROM incoming; COMMIT;"

echo "[sync-store-logins] synced $rows login rows from ${#TENANTS[@]} stores"
