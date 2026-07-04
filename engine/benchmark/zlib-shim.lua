-- engine/benchmark/zlib-shim.lua
--
-- REAL zlib binding for headless PoB2 (ADR-001 consequence: "work around headless
-- gaps at the shim layer ... rather than patching the engine"; PRD §9.1: Deflate/
-- Inflate are stubbed empty at HeadlessWrapper.lua:95-102 and MUST be fixed).
--
-- The founder rule is that the PoB2 fork is consumed UNMODIFIED (ADR-001). So we
-- do NOT edit HeadlessWrapper.lua. Instead we OVERRIDE the global `Deflate` and
-- `Inflate` functions AFTER the wrapper has installed its empty stubs, binding
-- them to a compiled zlib rock (lua-zlib, built into the Docker image). PoB code
-- calls the globals, so redefining them is sufficient and non-invasive.
--
-- SCOPE NOTE: the benchmark itself loads builds via loadBuildFromXML (no
-- compression on that path), so timing does not depend on this shim. It exists
-- because (a) the deliverable requires a real binding present in the image, and
-- (b) any share-code (base64+zlib) round-trip — Spike 2's territory — needs it.
-- BYTE-PARITY with desktop PoB export is explicitly Spike 2, not asserted here.

local ok, zlib = pcall(require, "zlib")
if not ok then
  io.stderr:write("[zlib-shim] WARN lua-zlib not available (" .. tostring(zlib) ..
                  "); leaving Deflate/Inflate stubs in place\n")
  return false
end

-- PoB share codes are standard zlib streams (0x78 header), matching desktop
-- Common.Deflate/Inflate. lua-zlib's default deflate/inflate produce/consume
-- exactly that framing.
--
-- lua-zlib streaming API: zlib.deflate([level]) -> function(chunk, flush)->out.
-- We drive it to completion in one shot with the "finish" flush.

function Deflate(data)  -- luacheck: ignore (intentionally global — overrides stub)
  if data == nil then return nil end
  local stream = zlib.deflate()
  local out, _eof, _bytes_in, _bytes_out = stream(data, "finish")
  return out
end

function Inflate(data)  -- luacheck: ignore (intentionally global — overrides stub)
  if data == nil then return nil end
  local stream = zlib.inflate()
  local out, _eof, _bytes_in, _bytes_out = stream(data)
  return out
end

io.stderr:write("[zlib-shim] real Deflate/Inflate installed (lua-zlib)\n")
return true
