/**
 * Data-driven hands-on levels. A LevelSpec describes the evidence a player reads,
 * the setting(s) they can change, and pure rules that decide whether it worked.
 */
import type { TermSpec, TermState } from './terminal';

export type Value = number | string | boolean | string[];
export type Cfg = Record<string, Value>;

export type Field =
  | { kind: 'number'; key: string; label: string; min: number; max: number; unit?: string; step?: number }
  | { kind: 'choice'; key: string; label: string; options: [value: string, label: string][] }
  | { kind: 'toggle'; key: string; label: string; on?: string; off?: string }
  | { kind: 'text'; key: string; label: string; placeholder?: string }
  | { kind: 'set'; key: string; label: string; options: [value: string, label: string][] }
  | { kind: 'order'; key: string; label: string; labels: Record<string, string> };

export interface Case {
  label: string;
  pass: boolean;
}

export interface Verdict {
  cases: Case[];
  /** Shown when something failed: a nudge, never the answer. */
  hint?: string;
  /** Worked, but with far more than needed (costs 1 Trust). */
  wasteful?: string;
}

export const passed = (v: Verdict): boolean => v.cases.every((c) => c.pass);

export interface LogLine {
  t?: string;
  text: string;
  note: string;
  evidence?: boolean;
}

export interface Bar {
  label: string;
  value: number;
  note: string;
  evidence?: boolean;
}

export interface Item {
  title: string;
  summary: string;
  detail: string;
  evidence?: boolean;
}

export type Evidence =
  | { kind: 'log'; id: string; icon: string; label: string; hint: string; lines: LogLine[]; diff?: boolean }
  | { kind: 'chart'; id: string; icon: string; label: string; hint: string; bars: Bar[]; unit?: string; limit?: { value: number; label: string } }
  | { kind: 'inspect'; id: string; icon: string; label: string; hint: string; items: Item[] }
  | { kind: 'search'; id: string; icon: string; label: string; hint: string; lines: string[]; evidence: RegExp; placeholder: string }
  | { kind: 'doc'; id: string; icon: string; label: string; text: string };

export interface Side {
  lines: string[];
  outcome: string;
}

export interface RecapSpec<S> {
  headline: string;
  before: Side;
  after: (s: S) => Side;
  why: string;
  real: string | ((s: S) => string);
  realCaption: string;
}

export interface Intro {
  symptom: string;
  known: string[];
  goal: string;
}

export interface Board {
  broken: string[];
  fixed: string[];
}

interface Base {
  id: string;
  intro: Intro;
  alert: string;
  board: Board;
  evidence: Evidence[];
}

/** Act 1 & 2: edit settings in a form, then the rules run. */
export interface ConfigLevel extends Base {
  type: 'config';
  configTitle: string;
  fields: Field[];
  start: Cfg;
  solution: Cfg;
  verify: (cfg: Cfg) => Verdict;
  /** Labels for the verification button and what is being watched. */
  applyLabel: string;
  recap: RecapSpec<Cfg>;
}

/**
 * A ready-made block the file editor can insert, so beginners never hand-type code or indentation.
 * `replace`: swap this exact text if the file still has it. `after`: insert below the line containing this.
 * Otherwise it goes in at the cursor.
 */
export interface Snippet {
  label: string;
  text: string;
  replace?: string;
  after?: string;
}

/** Act 3: a simulated terminal with real-looking commands and files. */
export interface TerminalLevel extends Base {
  type: 'terminal';
  term: TermSpec;
  /** Insert buttons shown in the file editor, per file. */
  snippets?: Record<string, Snippet[]>;
  /** Applies the intended fix to a state (used by tests). */
  solve: (s: TermState) => void;
  check: (s: TermState) => Verdict;
  recap: RecapSpec<TermState>;
}

export type LevelSpec = ConfigLevel | TerminalLevel;

// ------------------------------------------------------------------ helpers for authoring
export const c = (label: string, pass: boolean): Case => ({ label, pass });
export const arr = (v: Value | undefined): string[] => (Array.isArray(v) ? v : []);
export const num = (v: Value | undefined): number => (typeof v === 'number' ? v : Number(v) || 0);
export const str = (v: Value | undefined): string => (typeof v === 'string' ? v : String(v ?? ''));
export const has = (v: Value | undefined, x: string): boolean => arr(v).includes(x);

/** Put a snippet into a file. Returns the new text and where the inserted text sits. */
export function applySnippet(content: string, sn: Snippet, cursor = content.length): { text: string; at: number; end: number } {
  if (sn.replace && content.includes(sn.replace)) {
    const at = content.indexOf(sn.replace);
    return { text: content.slice(0, at) + sn.text + content.slice(at + sn.replace.length), at, end: at + sn.text.length };
  }
  if (sn.after) {
    const i = content.indexOf(sn.after);
    if (i >= 0) {
      const eol = content.indexOf('\n', i);
      const cut = eol < 0 ? content.length : eol;
      const at = cut + 1;
      return { text: `${content.slice(0, cut)}\n${sn.text}${content.slice(cut)}`, at, end: at + sn.text.length };
    }
  }
  const at = Math.max(0, Math.min(cursor, content.length));
  return { text: content.slice(0, at) + sn.text + content.slice(at), at, end: at + sn.text.length };
}
