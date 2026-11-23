#!/bin/bash
# Run scripts/agent-reply.ts with the support app's own settings, as its own user. Root.
#   agent-reply.sh --ticket UWS-410C38D478 --to customer@example.com --file /path/reply.txt [--send]
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root (it reads /etc/uplink-support/.env)" >&2; exit 1; }
set -a; . /etc/uplink-support/.env; set +a
unset POOL_DATABASE_URL
cd /opt/uplink-support
exec sudo -E -u debian node_modules/.bin/tsx scripts/agent-reply.ts "$@"
