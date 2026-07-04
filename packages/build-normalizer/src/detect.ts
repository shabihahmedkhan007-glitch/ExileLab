// detectSource — the landing paste-box "accepts anything" router. Given arbitrary
// pasted text, pick the importer that recognises it. Order matters: the native
// JSON format is the most specific (exact discriminator), so it is tried first;
// the PoB code decoder is more permissive and comes second.

import { NativeJsonImporter } from "./importers/native-json.js";
import { PobCodeImporter } from "./importers/pob-code.js";
import { UnknownSourceError } from "./errors.js";
import type { Importer } from "./importers/importer.js";
import type { RawImportArtifact } from "./raw-import-artifact.js";

/** The importer registry, in detection-priority order (most specific first). */
export const importers: readonly Importer[] = [
  new NativeJsonImporter(),
  new PobCodeImporter(),
];

/**
 * Return the importer that recognises `input`, or null if none does.
 * Pure and side-effect-free (no I/O beyond parsing the given text).
 */
export function detectSource(input: string): Importer | null {
  for (const importer of importers) {
    if (importer.detect(input)) return importer;
  }
  return null;
}

/**
 * Route + import in one step. Throws UnknownSourceError when nothing matches, or
 * ImportError when a matched importer rejects the payload. Never crashes on
 * arbitrary text — the "accepts anything" contract always yields a typed result.
 */
export function importAny(input: string): RawImportArtifact {
  const importer = detectSource(input);
  if (importer === null) throw new UnknownSourceError();
  return importer.import(input);
}
