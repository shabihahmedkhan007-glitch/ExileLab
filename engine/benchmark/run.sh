#!/usr/bin/env bash
# engine/benchmark/run.sh
#
# S1 benchmark launcher. Runs INSIDE the engine image (Dockerfile ENTRYPOINT), and
# is also the reference for the LUA_PATH the production sidecar will need. It sets
# up the module search path so the unmodified PoB2 HeadlessWrapper resolves its
# modules against the pinned fork's src/, then drives bench.lua.
#
# Output: bench.lua writes the JSON report to stdout. Exit code is the GATE:
#   0  -> GO      (median full calc < 500ms AND median misc recalc < 50ms)
#   3  -> NO-GO   (fall back to precomputed-candidate mode — PLAN Phase 0 risks)
#   other -> harness/engine error (see stderr).
#
# If /out is mounted, a copy of the report is also written to /out/s1-report.json
# so it can be wired into the conformance-suite fixtures on the host (README
# §"Wiring results into conformance").

set -euo pipefail

POB_SRC="${POB_SRC:-/work/pob/src}"
BENCH_DIR="${BENCH_DIR:-/work/bench}"
WRAPPER="${POB_SRC}/HeadlessWrapper.lua"

if [ ! -f "${WRAPPER}" ]; then
  echo "run.sh: ERROR HeadlessWrapper not found at ${WRAPPER}" >&2
  echo "run.sh: is the PoB2 submodule pinned at engine/vendor/PathOfBuilding-PoE2?" >&2
  exit 2
fi

# LuaJIT module search path. HeadlessWrapper installs its own LoadModule, but a
# permissive LUA_PATH covers `require` fallbacks against the fork layout.
export LUA_PATH="${POB_SRC}/?.lua;${POB_SRC}/Classes/?.lua;${POB_SRC}/Modules/?.lua;${POB_SRC}/Data/?.lua;;"
export LUA_CPATH="/usr/lib/x86_64-linux-gnu/lua/5.1/?.so;/usr/local/lib/lua/5.1/?.so;;"

# PoB expects to run from src/ (relative data paths).
cd "${POB_SRC}"

echo "run.sh: LUA_PATH=${LUA_PATH}" >&2
echo "run.sh: launching bench.lua (fixtures=${BENCH_FIXTURE_DIR:-/work/fixtures})" >&2

set +e
REPORT="$(luajit "${BENCH_DIR}/bench.lua" "${WRAPPER}")"
GATE=$?
set -e

echo "${REPORT}"

if [ -d /out ]; then
  printf '%s\n' "${REPORT}" > /out/s1-report.json
  echo "run.sh: wrote /out/s1-report.json" >&2
fi

case "${GATE}" in
  0) echo "run.sh: GATE=GO" >&2 ;;
  3) echo "run.sh: GATE=NO-GO (precomputed-candidate fallback)" >&2 ;;
  *) echo "run.sh: harness/engine error (exit ${GATE})" >&2 ;;
esac

exit "${GATE}"
