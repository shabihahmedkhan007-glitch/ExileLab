-- engine/benchmark/bench.lua
--
-- S1 ENGINE BENCHMARK DRIVER (PRD §9.3 spike 1 / PRODUCT_PLAN Phase 0 S1).
-- Drives the UNMODIFIED PoB2 fork headless (ADR-001) over 3 representative real
-- builds (melee / minion / DoT) and times the three cost centres the optimizer
-- worker-pool sizing model depends on:
--   (a) full calc passes            -> calcs.buildOutput(build, "MAIN")
--   (b) 500 misc-calculator recalcs -> calcs.getMiscCalculator(build)  (cheap overrides)
--   (c) a node-calculator tree sweep-> calcs.getNodeCalculator(build)  (one-step node deltas)
-- and emits JSON {median, p95, per-build} to stdout for the GO/NO-GO gate.
--
-- HARD RULES: no network, no LLM, deterministic. This file only measures; it
-- computes nothing about builds itself (principle #1 — the engine is the sole
-- calculator).
--
-- EXECUTION BOUNDARY (honest): this driver targets the PoB2 fork's documented
-- headless surface — the globals HeadlessWrapper.lua installs (`build`,
-- `loadBuildFromXML`, `LoadModule`) and the Calcs.lua entrypoints the PRD cites
-- (buildOutput @397, getMiscCalculator @123, getNodeCalculator @115). It has NOT
-- been executed here (no LuaJIT / no Docker on the authoring machine, and the
-- upstream submodule is an unpinned founder decision). The two integration points
-- most likely to need a one-line adjustment against the actual pin are marked
-- `-- PIN-CHECK:` below. See README §"Running" and docs/spikes/s1-engine-benchmark.md.

-- ---------------------------------------------------------------------------
-- Config (overridable via environment)
-- ---------------------------------------------------------------------------

local FIXTURE_DIR   = os.getenv("BENCH_FIXTURE_DIR") or "/work/fixtures"   -- *.xml (converted)
local FULL_ITERS    = tonumber(os.getenv("BENCH_FULL_ITERS")) or 30        -- full-pass samples/build
local MISC_ITERS    = tonumber(os.getenv("BENCH_MISC_ITERS")) or 500       -- override recalcs/build
local NODE_SWEEP    = tonumber(os.getenv("BENCH_NODE_SWEEP")) or 200        -- nodes swept/build
local WARMUP        = tonumber(os.getenv("BENCH_WARMUP")) or 3              -- discarded warmup passes

-- The 3 benchmark builds. Filenames are the XML produced by convert-fixture.ts
-- from research/fixtures/benchmark-builds/*.json (see README). Ordered melee,
-- minion, DoT per the PRD's "representative real builds".
local BUILDS = {
  { archetype = "melee",  file = "melee.xml"  },
  { archetype = "minion", file = "minion.xml" },
  { archetype = "dot",    file = "dot.xml"    },
}

-- ---------------------------------------------------------------------------
-- Timing + statistics helpers
-- ---------------------------------------------------------------------------

-- Monotonic-ish millisecond clock. os.clock() is CPU-seconds under LuaJIT, which
-- is exactly what we want for a single-threaded per-vCPU cost measurement.
local function now_ms()
  return os.clock() * 1000.0
end

local function sorted_copy(t)
  local c = {}
  for i = 1, #t do c[i] = t[i] end
  table.sort(c)
  return c
end

-- Linear-interpolation percentile over an unsorted sample array (ms).
local function percentile(samples, p)
  local n = #samples
  if n == 0 then return 0.0 end
  local s = sorted_copy(samples)
  if n == 1 then return s[1] end
  local rank = (p / 100.0) * (n - 1) + 1
  local lo = math.floor(rank)
  local hi = math.ceil(rank)
  if lo == hi then return s[lo] end
  local frac = rank - lo
  return s[lo] + (s[hi] - s[lo]) * frac
end

local function median(samples) return percentile(samples, 50) end

local function mean(samples)
  local n = #samples
  if n == 0 then return 0.0 end
  local sum = 0.0
  for i = 1, n do sum = sum + samples[i] end
  return sum / n
end

-- ---------------------------------------------------------------------------
-- Minimal deterministic JSON encoder (avoids depending on a bundled lib).
-- Handles: number, string, boolean, array (1..n) and string-keyed object.
-- ---------------------------------------------------------------------------

local json = {}

local function json_escape(s)
  return (s:gsub('[%z\1-\31\\"]', function(c)
    local map = { ['"'] = '\\"', ['\\'] = '\\\\', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }
    return map[c] or string.format('\\u%04x', string.byte(c))
  end))
end

local function is_array(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n == #t
end

function json.encode(v, indent)
  indent = indent or ""
  local ni = indent .. "  "
  local tv = type(v)
  if tv == "number" then
    -- Round ms to 3 decimals for stable, readable output.
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    -- Parenthesized so the gsub match-count (2nd return) is truncated away.
    return (string.format("%.3f", v):gsub("%.?0+$", ""))
  elseif tv == "string" then
    return '"' .. json_escape(v) .. '"'
  elseif tv == "boolean" then
    return v and "true" or "false"
  elseif tv == "nil" then
    return "null"
  elseif tv == "table" then
    if #v == 0 and next(v) == nil then return "{}" end
    if is_array(v) then
      local parts = {}
      for i = 1, #v do parts[i] = ni .. json.encode(v[i], ni) end
      return "[\n" .. table.concat(parts, ",\n") .. "\n" .. indent .. "]"
    else
      -- Deterministic key order.
      local keys = {}
      for k in pairs(v) do keys[#keys + 1] = k end
      table.sort(keys)
      local parts = {}
      for _, k in ipairs(keys) do
        parts[#parts + 1] = ni .. '"' .. json_escape(k) .. '": ' .. json.encode(v[k], ni)
      end
      return "{\n" .. table.concat(parts, ",\n") .. "\n" .. indent .. "}"
    end
  end
  return "null"
end

-- ---------------------------------------------------------------------------
-- Engine bootstrap (PoB2 headless)
-- ---------------------------------------------------------------------------

-- LUA_PATH is set by run.sh so that HeadlessWrapper's `require`/LoadModule resolve
-- against the pinned PoB2 `src/`. dofile installs the globals we drive.
-- PIN-CHECK: the wrapper path is passed as arg[1]; run.sh supplies it.
local WRAPPER = arg and arg[1] or (os.getenv("POB_SRC") or ".") .. "/HeadlessWrapper.lua"

local function log(msg)
  io.stderr:write("[bench] " .. msg .. "\n")
end

local function read_file(path)
  local f = assert(io.open(path, "r"), "cannot open fixture: " .. path)
  local data = f:read("*a")
  f:close()
  return data
end

log("bootstrapping PoB2 headless via " .. WRAPPER)
dofile(WRAPPER)  -- installs globals: build, loadBuildFromXML, LoadModule, ...

-- Install the real zlib binding OVER the wrapper's empty Deflate/Inflate stubs
-- (PRD §9.1 / ADR-001). Non-fatal for the XML-load timing path; required for any
-- share-code round-trip. Path resolved next to this driver.
do
  local shim = (os.getenv("BENCH_ZLIB_SHIM")) or "/work/bench/zlib-shim.lua"
  local ok, err = pcall(dofile, shim)
  if not ok then log("WARN could not load zlib shim (" .. tostring(err) .. ")") end
end

-- PIN-CHECK: Calcs entrypoints. The PRD cites these exact names (Calcs.lua):
--   calcs.buildOutput(build, mode), calcs.getMiscCalculator(build),
--   calcs.getNodeCalculator(build). If the pin exposes them only via
--   build.calcsTab (:BuildOutput / :GetMiscCalculator / :GetNodeCalculator),
--   swap the three call sites in bench_one() accordingly.
local calcs = LoadModule("Modules/Calcs")

-- ---------------------------------------------------------------------------
-- Per-build benchmark
-- ---------------------------------------------------------------------------

-- Load a fixture build into the engine. loadBuildFromXML is installed by the
-- headless wrapper; it parses the PoB XML document and populates `build`.
local function load_build(xml_path)
  local xml = read_file(xml_path)
  loadBuildFromXML(xml)  -- PIN-CHECK: some forks name this build.loadBuildFromXML
  -- One implicit full build so the calc env is warm before we start timing.
  calcs.buildOutput(build, "MAIN")
  return build
end

local function bench_full(b)
  local samples = {}
  for i = 1, WARMUP + FULL_ITERS do
    local t0 = now_ms()
    calcs.buildOutput(b, "MAIN")
    local dt = now_ms() - t0
    if i > WARMUP then samples[#samples + 1] = dt end
  end
  return samples
end

local function bench_misc(b)
  -- One base env, many cheap override recalcs (the optimizer's hot path).
  -- getMiscCalculator returns a closure that recomputes with an override table
  -- against a shared base env. We vary a trivial override each iteration so the
  -- engine cannot short-circuit to a cached identical result.
  local calcFunc = calcs.getMiscCalculator(b)  -- PIN-CHECK: may return (func, baseOutput)
  local samples = {}
  for i = 1, MISC_ITERS do
    local override = { repeatCount = (i % 3) + 1 }
    local t0 = now_ms()
    calcFunc(override, nil)
    local dt = now_ms() - t0
    samples[#samples + 1] = dt
  end
  return samples
end

local function bench_node_sweep(b)
  -- One-step node deltas across allocatable frontier nodes. getNodeCalculator
  -- returns a closure that evaluates the effect of toggling a node. We sweep the
  -- build's own allocated nodes (guaranteed to exist for the pin) as a stable,
  -- fixture-independent set; a production sweep would target the reachable
  -- frontier, but cost per node is what we measure here.
  local nodeCalcFunc = calcs.getNodeCalculator(b)  -- PIN-CHECK: may return (func, base)
  local spec = b.spec or (b.calcsTab and b.calcsTab.calcsEnv and b.calcsTab.calcsEnv.spec)
  local node_ids = {}
  if spec and spec.allocNodes then
    for id in pairs(spec.allocNodes) do node_ids[#node_ids + 1] = id end
  end
  table.sort(node_ids)
  local samples = {}
  local count = math.min(NODE_SWEEP, #node_ids)
  for i = 1, count do
    local id = node_ids[i]
    local t0 = now_ms()
    nodeCalcFunc(id)  -- evaluate toggling one node
    local dt = now_ms() - t0
    samples[#samples + 1] = dt
  end
  if #samples == 0 then
    log("WARN node sweep collected 0 samples (no reachable alloc nodes on " ..
        tostring(spec) .. "); reporting zeros")
  end
  return samples
end

local function summarize(samples)
  return {
    n = #samples,
    median_ms = median(samples),
    p95_ms = percentile(samples, 95),
    mean_ms = mean(samples),
    min_ms = (#samples > 0) and sorted_copy(samples)[1] or 0.0,
    max_ms = (#samples > 0) and sorted_copy(samples)[#samples] or 0.0,
  }
end

local function bench_one(entry)
  local path = FIXTURE_DIR .. "/" .. entry.file
  log("loading " .. entry.archetype .. " <- " .. path)
  local b = load_build(path)
  log("  full-calc x" .. FULL_ITERS)
  local full = bench_full(b)
  log("  misc-recalc x" .. MISC_ITERS)
  local misc = bench_misc(b)
  log("  node-sweep x" .. NODE_SWEEP)
  local nodes = bench_node_sweep(b)
  return {
    archetype = entry.archetype,
    fixture = entry.file,
    full_calc = summarize(full),
    misc_recalc = summarize(misc),
    node_sweep = summarize(nodes),
  }
end

-- ---------------------------------------------------------------------------
-- Aggregate across builds + GO/NO-GO evaluation
-- ---------------------------------------------------------------------------

local GATE_FULL_MEDIAN_MS = tonumber(os.getenv("BENCH_GATE_FULL_MS")) or 500
local GATE_MISC_MEDIAN_MS = tonumber(os.getenv("BENCH_GATE_MISC_MS")) or 50

local per_build = {}
local full_medians, misc_medians = {}, {}
for _, entry in ipairs(BUILDS) do
  local ok, res = pcall(bench_one, entry)
  if ok then
    per_build[#per_build + 1] = res
    full_medians[#full_medians + 1] = res.full_calc.median_ms
    misc_medians[#misc_medians + 1] = res.misc_recalc.median_ms
  else
    log("ERROR benchmarking " .. entry.archetype .. ": " .. tostring(res))
    per_build[#per_build + 1] = { archetype = entry.archetype, fixture = entry.file, error = tostring(res) }
  end
end

-- The gate is on the WORST build (max of per-build medians) — the pool must
-- survive the slowest representative build, not the average.
local worst_full = 0.0
for _, m in ipairs(full_medians) do if m > worst_full then worst_full = m end end
local worst_misc = 0.0
for _, m in ipairs(misc_medians) do if m > worst_misc then worst_misc = m end end

local go = (#full_medians > 0)
  and (worst_full < GATE_FULL_MEDIAN_MS)
  and (worst_misc < GATE_MISC_MEDIAN_MS)

local report = {
  spike = "S1-engine-benchmark",
  engine = "pob2-headless (pin from engine/vendor/PathOfBuilding-PoE2)",
  units = "milliseconds (os.clock CPU-seconds x1000, single vCPU)",
  config = {
    full_iters = FULL_ITERS,
    misc_iters = MISC_ITERS,
    node_sweep = NODE_SWEEP,
    warmup = WARMUP,
  },
  gate = {
    full_calc_median_ms = GATE_FULL_MEDIAN_MS,
    misc_recalc_median_ms = GATE_MISC_MEDIAN_MS,
    worst_full_calc_median_ms = worst_full,
    worst_misc_recalc_median_ms = worst_misc,
    decision = go and "GO" or "NO-GO",
    fallback_if_no_go = "precomputed-candidate mode (PRODUCT_PLAN risks / PRD §11 Phase 0)",
  },
  per_build = per_build,
}

io.write(json.encode(report))
io.write("\n")

-- Non-zero exit on NO-GO so CI / run.sh can branch on the gate.
os.exit(go and 0 or 3)
