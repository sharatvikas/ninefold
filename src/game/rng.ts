/** A small seeded random number generator, so generated content and scenery are the same on every run. */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822519) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}
