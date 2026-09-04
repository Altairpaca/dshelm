#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <dshelm-version> <dsh-version>" >&2
  exit 2
fi

DSHELM_VERSION="$1"
DSH_VERSION="$2"
TMP_ROOT="$(mktemp -d -t dshelm-registry-smoke-XXXXXX)"
HOME_DIR="$TMP_ROOT/home"
DSH_HOME_DIR="$TMP_ROOT/dsh-home"
CONSUMER_DIR="$TMP_ROOT/consumer"
PROJECT_DIR="$TMP_ROOT/project"
trap 'rm -rf "$TMP_ROOT"' EXIT

mkdir -p "$HOME_DIR" "$DSH_HOME_DIR/profiles/other" "$CONSUMER_DIR" "$PROJECT_DIR"
printf '%s\n' '[]' > "$DSH_HOME_DIR/cordis.patch.yml"
printf '%s\n' '{"name":"other","private":true}' > "$DSH_HOME_DIR/profiles/other/package.json"
printf '%s\n' '{"private":true}' > "$CONSUMER_DIR/package.json"

stage() {
  printf '\n==> registry-smoke: %s\n' "$1"
}

stage "install dshelm@$DSHELM_VERSION and @deepseek-ai/dsh@$DSH_VERSION from npm"
NPM_CONFIG_FETCH_TIMEOUT=60000 \
NPM_CONFIG_FETCH_RETRIES=2 \
npm install --prefix "$CONSUMER_DIR" --no-audit --no-fund --loglevel=warn \
  "dshelm@$DSHELM_VERSION" "@deepseek-ai/dsh@$DSH_VERSION"

DSHELM_BIN="$CONSUMER_DIR/node_modules/.bin/dshelm"
DSH_BIN="$CONSUMER_DIR/node_modules/.bin/dsh"
test -x "$DSHELM_BIN"
test -x "$DSH_BIN"

export HOME="$HOME_DIR"
export DSH_HOME="$DSH_HOME_DIR"
export PATH="$CONSUMER_DIR/node_modules/.bin:$PATH"

stage "doctor before init (absence must be explicit)"
set +e
(cd "$PROJECT_DIR" && "$DSHELM_BIN" doctor)
DOCTOR_BEFORE=$?
set -e
printf 'doctor-before-exit=%s\n' "$DOCTOR_BEFORE"

stage "initialize profile from published packages"
(cd "$PROJECT_DIR" && "$DSHELM_BIN" init --yes)
test -f "$PROJECT_DIR/.dshelm/profile.json"
test -f "$DSH_HOME_DIR/profiles/dshelm/package.json"
test -f "$DSH_HOME_DIR/profiles/dshelm/node_modules/@dshelm/dsh/package.json"

stage "doctor after init"
(cd "$PROJECT_DIR" && "$DSHELM_BIN" doctor)

stage "published DSH profile composition"
(cd "$PROJECT_DIR" && "$DSH_BIN" --profile dshelm --dump-config) > "$TMP_ROOT/dump-config.txt"
grep -A2 '# == @dshelm/dsh' "$TMP_ROOT/dump-config.txt"

stage "uninstall and preserve unrelated DSH state"
(cd "$PROJECT_DIR" && "$DSHELM_BIN" uninstall --yes)
test ! -e "$PROJECT_DIR/.dshelm/profile.json"
test ! -e "$DSH_HOME_DIR/profiles/dshelm"
test -f "$DSH_HOME_DIR/cordis.patch.yml"
test -f "$DSH_HOME_DIR/profiles/other/package.json"

stage "doctor after uninstall (absence must remain explicit)"
set +e
(cd "$PROJECT_DIR" && "$DSHELM_BIN" doctor)
DOCTOR_AFTER=$?
set -e
printf 'doctor-after-uninstall-exit=%s\n' "$DOCTOR_AFTER"

echo "qa:registry-install OK (DSHelm $DSHELM_VERSION / DSH $DSH_VERSION)"
