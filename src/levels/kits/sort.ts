/** Pure rules for the Sort & Match kit: put each item in the right slot. */

export interface SortPuzzle {
  items: readonly string[];
  slots: readonly string[];
  initial: Readonly<Record<string, string>>;
  answer: Readonly<Record<string, string>>;
}

export interface SortState {
  assign: Record<string, string>;
  wrongMoves: number;
  solved: boolean;
}

export const SORT_REWARD = 5;

export function isSolved(p: SortPuzzle, assign: Record<string, string>): boolean {
  return p.items.every((i) => assign[i] === p.answer[i]);
}

export function newSortState(p: SortPuzzle): SortState {
  const assign = { ...p.initial };
  return { assign, wrongMoves: 0, solved: isSolved(p, assign) };
}

export function moveItem(p: SortPuzzle, s: SortState, item: string, slot: string): { state: SortState; correct: boolean } {
  if (!p.items.includes(item) || !p.slots.includes(slot)) throw new Error(`Bad move ${item} -> ${slot}`);
  if (s.solved || s.assign[item] === slot) return { state: s, correct: p.answer[item] === slot };
  const correct = p.answer[item] === slot;
  const assign = { ...s.assign, [item]: slot };
  return {
    state: { assign, wrongMoves: s.wrongMoves + (correct ? 0 : 1), solved: isSolved(p, assign) },
    correct,
  };
}

/** Trust earned: full reward minus one per wrong move, never below 1. */
export function sortTrust(s: SortState): number {
  return Math.max(1, SORT_REWARD - s.wrongMoves);
}
