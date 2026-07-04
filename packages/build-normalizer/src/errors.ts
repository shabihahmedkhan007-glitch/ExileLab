// Typed errors for the importer/normalizer boundary. Malformed input must always
// surface a typed error, never an uncaught crash (task requirement).

/** Base class so callers can `catch (e) { if (e instanceof NormalizerError) ... }`. */
export abstract class NormalizerError extends Error {
  /** Stable, machine-readable discriminator. */
  abstract readonly code: string;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    if (options?.cause !== undefined) {
      // Preserve the underlying cause without leaking it into the message.
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** No importer recognised the pasted input (the "accepts anything" paste box). */
export class UnknownSourceError extends NormalizerError {
  readonly code = "unknown_source" as const;
  constructor() {
    super("No importer recognised the input; the paste does not match any known build format.");
  }
}

/** An importer recognised the shape but the payload was malformed. */
export class ImportError extends NormalizerError {
  readonly code = "import_failed" as const;
  constructor(
    readonly source: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(`[${source}] ${message}`, options);
  }
}

/** The normalizer could not turn a Raw Import Artifact into a valid snapshot. */
export class NormalizeError extends NormalizerError {
  readonly code = "normalize_failed" as const;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}
