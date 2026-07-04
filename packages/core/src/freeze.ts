// @exilelab/core — deep-freeze utility enforcing BuildSnapshot immutability (I1).

/**
 * Recursively Object.freeze an object graph in place and return it (typed as the
 * input). In strict-mode code (ES modules are always strict) any later write to
 * a frozen property throws a TypeError — the runtime teeth behind invariant I1.
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}
