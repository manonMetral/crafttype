/** A copy of the array that nobody can modify: the caller keeps its own array, the holder cannot be affected by it. */
export const frozenCopy = <T>(items: readonly T[]): readonly T[] => Object.freeze([...items]);

/** A copy of the record that nobody can modify (see `frozenCopy`). */
export const frozenRecord = <V>(record: Readonly<Record<string, V>>): Readonly<Record<string, V>> =>
  Object.freeze({ ...record });
