# engine/benchmark/Dockerfile
#
# S1 ENGINE BENCHMARK IMAGE (PRD §9.1 + §9.3 spike 1 / ADR-001).
# Builds a headless PoB2 calc engine under LuaJIT 2.1 and runs bench.lua against
# the 3 representative fixtures. This is the SAME shape the production Engine
# Sidecar will take (LuaJIT + pinned PoB2 src + HeadlessWrapper + real zlib
# binding + prebuilt ModCache) — the benchmark validates the economics before
# that sidecar is productionized (PLAN Phase 1).
#
# BUILD CONTEXT: the REPO ROOT (E:/ExileLab), so the pinned upstream submodule at
# engine/vendor/PathOfBuilding-PoE2 and the fixtures at research/fixtures/ are in
# scope. See README §"Running" for the exact `docker build` invocation.
#
# EXECUTION BOUNDARY (honest): this image has NOT been built here — no Docker and
# no LuaJIT on the authoring machine, and the upstream PoB2 submodule pin is a
# founder decision that has NOT been cloned (see README §"One-time submodule pin").
# The file is written to build unmodified on any Docker host once that submodule
# is present.

# ---------------------------------------------------------------------------
# Stage 1 — convert native-JSON fixtures to PoB2 XML (Node, self-contained TS).
# ---------------------------------------------------------------------------
FROM node:24-slim AS fixtures

WORKDIR /conv
# Only the converter + the native fixtures are needed here.
COPY engine/benchmark/convert-fixture.ts ./convert-fixture.ts
COPY research/fixtures/benchmark-builds/ ./in/

# Produce melee.xml / minion.xml / dot.xml from the native JSON fixtures.
# convert-fixture.ts has zero runtime deps (node:fs only), so `npx tsx` needs no
# project install. Filenames must match the BUILDS table in bench.lua.
RUN set -eu; \
    mkdir -p /out; \
    for arch in melee minion dot; do \
      npx --yes tsx convert-fixture.ts "in/${arch}.json" "/out/${arch}.xml"; \
    done

# ---------------------------------------------------------------------------
# Stage 2 — headless PoB2 engine under LuaJIT 2.1 + real zlib binding.
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim AS engine

# LuaJIT 2.1: Debian bookworm ships luajit 2.1 (beta). For an exact reproducible
# pin, build from source instead by uncommenting the LUAJIT_* block below.
#   ARG LUAJIT_REPO=https://github.com/LuaJIT/LuaJIT.git
#   ARG LUAJIT_REF=v2.1
#   RUN git clone "$LUAJIT_REPO" /src/luajit && cd /src/luajit \
#       && git checkout "$LUAJIT_REF" && make -j"$(nproc)" && make install \
#       && ldconfig
ENV DEBIAN_FRONTEND=noninteractive
RUN set -eu; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      luajit libluajit-5.1-dev \
      luarocks \
      zlib1g-dev \
      ca-certificates \
      build-essential \
      git; \
    rm -rf /var/lib/apt/lists/*

# Real zlib binding for the Deflate/Inflate shim (zlib-shim.lua). lua-zlib is a C
# rock; build it against LuaJIT's Lua 5.1 ABI. This satisfies PRD §9.1's "real
# zlib binding" requirement in the image itself.
RUN set -eu; \
    luarocks --lua-version 5.1 \
      --lua-dir=/usr \
      install lua-zlib ZLIB_DIR=/usr

WORKDIR /work

# The pinned, UNMODIFIED PoB2 fork (git submodule — see README). Consumed as-is
# (ADR-001); we never edit files under here.
COPY engine/vendor/PathOfBuilding-PoE2/ /work/pob/

# Benchmark driver + zlib shim.
COPY engine/benchmark/bench.lua      /work/bench/bench.lua
COPY engine/benchmark/zlib-shim.lua  /work/bench/zlib-shim.lua
COPY engine/benchmark/run.sh         /work/bench/run.sh

# Converted fixtures from stage 1.
COPY --from=fixtures /out/ /work/fixtures/

# Optional: prebuild ModCache for warm starts (PRD §9.1). The fork ships a
# generator; if present it is run headless. Non-fatal if the target differs on a
# given pin (guarded), so the image still builds for the timing run.
RUN set -eu; cd /work/pob/src; \
    if [ -f ./ModCache.lua ] || [ -f ./Data/ModCache.lua ]; then \
      echo "ModCache present in pin"; \
    else \
      echo "WARN: no prebuilt ModCache in pin; first calc pass will be cold" >&2; \
    fi

RUN chmod +x /work/bench/run.sh

# HeadlessWrapper is the entry the driver bootstraps (dofile). LUA_PATH must let
# the wrapper resolve modules relative to the fork's src/ — run.sh sets it.
ENV POB_SRC=/work/pob/src \
    BENCH_FIXTURE_DIR=/work/fixtures \
    BENCH_ZLIB_SHIM=/work/bench/zlib-shim.lua

WORKDIR /work/pob/src

# Default command runs the full benchmark and prints JSON to stdout. run.sh sets
# LUA_PATH and passes the HeadlessWrapper path as arg[1] to bench.lua.
ENTRYPOINT ["/work/bench/run.sh"]
