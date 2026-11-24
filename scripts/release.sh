#!/bin/bash
# Support app release: build in a copy, test the copy on :3199, swap, verify, roll back on failure.
# Runs as root on app-server. Never builds in the live tree.
#
#   sudo systemd-run --unit support-release --collect /bin/bash /opt/uplink-support/scripts/release.sh \
#        --branch <branch> --mark '<text only in the new code>' [--stop-before-swap]
#
# Read the result with: journalctl -u support-release. Wait on ActiveState, not is-active.
# For a release that changes dependencies use the dated script it was modelled on
# (/root/support-deploy-20261123.sh): this one assumes package.json is unchanged.
set -uo pipefail
if [ -z "${SUP_RELEASE_COPY:-}" ]; then   # the merge below would change this file mid-run
	SELF=$(mktemp /run/support-release.XXXXXX) || exit 1
	cp "$0" "$SELF" || exit 1
	SUP_RELEASE_COPY=1 exec /bin/bash "$SELF" "$@"
fi
BRANCH=""; MARK=""; STOP=0
while [ $# -gt 0 ]; do
	case "$1" in
		--branch) BRANCH="${2:-}"; shift 2 ;;
		--mark) MARK="${2:-}"; shift 2 ;;
		--stop-before-swap) STOP=1; shift ;;
		*) echo "unknown option: $1"; exit 2 ;;
	esac
done
[ -n "$BRANCH" ] && [ -n "$MARK" ] || { echo "usage: release.sh --branch <name> --mark '<text>' [--stop-before-swap]"; exit 2; }
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 2; }
TS=$(date +%Y%m%d-%H%M%S); L=/opt/uplink-support; B=/opt/uplink-support-build; KEEP=3
G="sudo -u debian git -C $L"
say(){ echo "[$(date +%T)] $*"; }
code(){ curl -s -o /dev/null -m 10 -w '%{http_code}' -H 'Host: support.uplink.net.au' -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$1$2"; }
css(){ local c; c=$(curl -s -m 10 -H 'Host: support.uplink.net.au' -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$1/" | grep -oE '/_next/static/[^"]+\.css' | head -1); [ -n "$c" ] && code "$1" "$c" || echo none; }

say "release $TS: branch $BRANCH$([ $STOP = 1 ] && echo ', stopping before the swap')"
[ "$(code 3081 /api/health)" = 200 ] || { say "live not healthy before starting; stopping"; exit 1; }
BEFORE=$($G rev-parse HEAD)
if [ "$BRANCH" != main ]; then
	[ -z "$($G diff --name-only "HEAD..$BRANCH" -- package.json pnpm-lock.yaml)" ] || { say "this branch changes dependencies; use the dependency release script. Stopping"; exit 1; }
	[ $STOP = 1 ] || $G merge -q --ff-only "$BRANCH" || { say "could not fast-forward the source tree; stopping"; exit 1; }
fi
SRC=$L; REF=HEAD
# A rehearsal must not move the live source tree (the mail poller runs from it): build the branch itself.
[ $STOP = 1 ] && REF="$BRANCH"
say "building $($G log --oneline -1 "$REF" | cut -c1-60)"
sudo -u debian rsync -a --delete --exclude /.next --exclude '/.next.prev-*' --exclude '/.next.failed-*' --exclude /.git --exclude /private-uploads $SRC/ $B/ || { say "rsync failed"; exit 1; }
if [ $STOP = 1 ] && [ "$BRANCH" != main ]; then
	$G archive "$REF" src scripts | sudo -u debian tar -x -C $B || { say "could not lay the branch over the copy"; exit 1; }
fi
( cd $B && sudo -u debian node_modules/.bin/tsc --noEmit ) || { say "typecheck FAILED; live untouched"; [ $STOP = 1 ] || $G reset -q --hard "$BEFORE"; exit 1; }
BLOG=/var/log/support-build-$TS.log; install -m 600 /dev/null $BLOG
( sudo -u debian -H env NEXT_TELEMETRY_DISABLED=1 bash -lc "cd $B && pnpm build" >> $BLOG 2>&1 ) || { say "BUILD FAILED; live untouched"; tail -15 $BLOG; [ $STOP = 1 ] || $G reset -q --hard "$BEFORE"; exit 1; }
rm -f $B/.next/standalone/.env $B/.next/standalone/.env.local
grep -rlqF -- "$MARK" $B/.next/standalone/.next/server || { say "new code not in the build (mark not found); stopping"; [ $STOP = 1 ] || $G reset -q --hard "$BEFORE"; exit 1; }
systemctl stop support-deploytest 2>/dev/null
systemd-run --quiet --unit support-deploytest --collect -p User=debian -p EnvironmentFile=/etc/uplink-support/.env -p WorkingDirectory=$B /usr/bin/env PORT=3199 HOSTNAME=127.0.0.1 /usr/bin/node .next/standalone/server.js
T=000; for i in $(seq 1 20); do sleep 1; T=$(code 3199 /api/health); [ "$T" = 200 ] && break; done; H=$(code 3199 /); CS=$(css 3199)
systemctl stop support-deploytest 2>/dev/null
say "copy on :3199: health $T, home $H, stylesheet $CS"
[ "$T" = 200 ] && [ "$H" = 200 ] && [ "$CS" = 200 ] || { say "copy failed its test; live untouched"; [ $STOP = 1 ] || $G reset -q --hard "$BEFORE"; exit 1; }
if [ $STOP = 1 ]; then say "STOPPED BEFORE SWAP as asked; live untouched"; exit 0; fi

say "swapping"
systemctl stop uplink-support
mv $L/.next $L/.next.prev-$TS && mv $B/.next $L/.next
ln -snf $L/.next/static $L/.next/standalone/.next/static; ln -snf $L/public $L/.next/standalone/public
chown -h debian:debian $L/.next/standalone/.next/static $L/.next/standalone/public
systemctl start uplink-support
A=000; for i in $(seq 1 30); do sleep 1; A=$(code 3081 /api/health); [ "$A" = 200 ] && break; done; H=$(code 3081 /); CS=$(css 3081)
if [ "$A" != 200 ] || [ "$H" != 200 ] || [ "$CS" != 200 ]; then
	say "live failed after swap (health $A, home $H, css $CS): ROLLING BACK"
	systemctl stop uplink-support; mv $L/.next $L/.next.failed-$TS; mv $L/.next.prev-$TS $L/.next
	$G reset -q --hard "$BEFORE"; systemctl start uplink-support; sleep 4
	say "rolled back; health $(code 3081 /api/health)"; exit 1
fi
say "live: health $A, home $H, stylesheet $CS, new code in served build: $(grep -rlF -- "$MARK" $L/.next/standalone/.next/server | wc -l) file(s), wrong-owner files: $(find $L/.next -maxdepth 2 ! -user debian | wc -l), down about ${i}s"
N=0; SHAPE='.next.prev-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]'
for old in $(ls -1d $L/$SHAPE 2>/dev/null | sort | head -n -$KEEP); do
	case "$old" in $L/$SHAPE) rm -rf -- "$old" && N=$((N+1)) ;; esac
done
say "older replaced builds removed: $N (newest $KEEP kept)"
say "DEPLOYED"
