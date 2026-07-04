// The Importer boundary. Importers are the ONLY components that know source
// formats (RFC-0001 §5.2). They accept pasted text / local payloads ONLY — no
// network calls, ever (CLAUDE.md hard rule 1, charter §7.5).

import type { BuildSource } from "../model.js";
import type { RawImportArtifact } from "../raw-import-artifact.js";

export interface Importer {
  /** The source format this importer handles. */
  readonly source: BuildSource;
  /** Cheap, side-effect-free check: does this input look like this importer's format? */
  detect(input: string): boolean;
  /**
   * Parse the input into a Raw Import Artifact. Throws ImportError on malformed
   * input that passed `detect`. Never performs I/O beyond parsing the given text.
   */
  import(input: string): RawImportArtifact;
}
