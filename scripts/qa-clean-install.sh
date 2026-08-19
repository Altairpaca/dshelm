#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 || $# -gt 5 ]]; then
  echo "usage: $0 <dshelm-cli-bin> <core-tarball> <model-knowledge-tarball> <dsh-tarball> [dsh-bin]" >&2
  exit 2
fi

CLI_BIN="$(readlink -f "$1")"
CORE_TGZ="$(readlink -f "$2")"
MODEL_KNOWLEDGE_TGZ="$(readlink -f "$3")"
DSH_TGZ="$(readlink -f "$4")"
# Preserve a supplied .bin symlink so `init` can find the same DSH CLI through
# PATH; resolving it would leave only the package lib directory on PATH.
DSH_BIN="$(realpath -s "${5:-dsh}")"
TMP_ROOT="$(mktemp -d -t dshelm-clean-install-XXXXXX)"
HOME_DIR="$TMP_ROOT/home"
DSH_HOME_DIR="$TMP_ROOT/dsh-home"
PROJECT_DIR="$TMP_ROOT/project"
CONFIG_DIR="$TMP_ROOT/config"
DSH_FIXTURE_ROOT="$TMP_ROOT/dsh-fixture"
mkdir -p "$HOME_DIR" "$DSH_HOME_DIR/profiles/other" "$PROJECT_DIR" "$CONFIG_DIR" "$DSH_FIXTURE_ROOT"
trap 'rm -r "$TMP_ROOT"' EXIT

mkdir -p "$CONFIG_DIR/credentials"
printf '%s\n' '{"version":1,"credentials":{"fixture":{"type":"api-key","value":"fixture-secret"}}}' > "$CONFIG_DIR/credentials/credentials.json"
chmod 600 "$CONFIG_DIR/credentials/credentials.json"

# The workspace packages are intentionally not published under @dshelm yet.
# Rewrite only this temporary fixture's two internal dependencies to local
# tarballs; production init still installs the public @dshelm/dsh spec.
mkdir -p "$DSH_FIXTURE_ROOT/unpack"
tar -xzf "$DSH_TGZ" -C "$DSH_FIXTURE_ROOT/unpack"
node - "$DSH_FIXTURE_ROOT/unpack/package/package.json" "$CORE_TGZ" "$MODEL_KNOWLEDGE_TGZ" <<'NODE'
const fs = require('node:fs')
const [manifestPath, coreTarball, knowledgeTarball] = process.argv.slice(2)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
manifest.dependencies['@dshelm/core'] = `file:${coreTarball}`
manifest.dependencies['@dshelm/model-knowledge'] = `file:${knowledgeTarball}`
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
NODE
tar -czf "$DSH_FIXTURE_ROOT/dshelm-dsh-fixture.tgz" -C "$DSH_FIXTURE_ROOT/unpack" package

printf '%s\n' '[]' > "$DSH_HOME_DIR/cordis.patch.yml"
printf '%s\n' '{"name":"other","private":true}' > "$DSH_HOME_DIR/profiles/other/package.json"

export HOME="$HOME_DIR"
export DSH_HOME="$DSH_HOME_DIR"
export DSHELM_CONFIG_DIR="$CONFIG_DIR"
export DSHELM_DSH_BUNDLE_SPECS="$CORE_TGZ,$MODEL_KNOWLEDGE_TGZ,$DSH_FIXTURE_ROOT/dshelm-dsh-fixture.tgz"
export PATH="$(dirname "$DSH_BIN"):$PATH"
run_cli() { node "$CLI_BIN" "$@"; }

echo '== init: official DSH profile installation =='
(cd "$PROJECT_DIR" && run_cli init --yes)
test -f "$PROJECT_DIR/.dshelm/profile.json"
test -f "$DSH_HOME_DIR/profiles/dshelm/package.json"
test -f "$DSH_HOME_DIR/profiles/dshelm/node_modules/@dshelm/dsh/package.json"
(cd "$PROJECT_DIR" && run_cli init --yes) > "$TMP_ROOT/init-second.txt"
grep -q 'Using existing' "$TMP_ROOT/init-second.txt"

echo '== dump-config: actual rc.7 profile =='
(cd "$PROJECT_DIR" && "$DSH_BIN" --profile dshelm --dump-config) > "$TMP_ROOT/dump-config.txt"
grep -A2 '# == @dshelm/dsh' "$TMP_ROOT/dump-config.txt"

echo '== boot: loader and plugin tree =='
set +e
(cd "$PROJECT_DIR" && timeout 12 "$DSH_BIN" --profile dshelm) > "$TMP_ROOT/boot.txt" 2>&1
BOOT_EXIT=$?
set -e
if [[ "$BOOT_EXIT" -ne 124 && "$BOOT_EXIT" -ne 0 ]]; then
  echo "dsh profile boot failed with exit $BOOT_EXIT" >&2
  sed -n '1,120p' "$TMP_ROOT/boot.txt" >&2
  exit 1
fi
if grep -Eiq 'profile .*does not exist|failed to load|cannot resolve.*@dshelm/dsh|unknown option' "$TMP_ROOT/boot.txt"; then
  echo 'dsh profile boot reported a loader/profile error' >&2
  sed -n '1,120p' "$TMP_ROOT/boot.txt" >&2
  exit 1
fi

echo '== doctor/explain =='
(cd "$PROJECT_DIR" && run_cli doctor) > "$TMP_ROOT/doctor.txt"
(cd "$PROJECT_DIR" && run_cli explain deepseek/deepseek-v4-flash) > "$TMP_ROOT/explain.txt"
grep -q 'execution=not-executed' "$TMP_ROOT/explain.txt"

echo '== uninstall and preservation =='
(cd "$PROJECT_DIR" && run_cli uninstall --yes)
test ! -e "$PROJECT_DIR/.dshelm/profile.json"
test ! -e "$DSH_HOME_DIR/profiles/dshelm"
test -f "$DSH_HOME_DIR/cordis.patch.yml"
test -f "$DSH_HOME_DIR/profiles/other/package.json"
test -f "$CONFIG_DIR/credentials/credentials.json"

echo '== purge credentials =='
(cd "$PROJECT_DIR" && run_cli uninstall --yes --purge-credentials)
test ! -e "$CONFIG_DIR/credentials/credentials.json"

echo 'qa:clean-install OK'
