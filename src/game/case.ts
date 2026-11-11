/**
 * One open ticket, from first read to verified fix. Pure: no DOM, no clock.
 * The UI calls these functions and draws whatever comes back.
 */
import { passed, type Cfg, type Evidence, type LevelSpec, type Value, type Verdict } from '../curriculum/spec';
import { newTermState, run, saveFile, type TermState } from '../curriculum/terminal';
import { newAttempts, ninesFor, type Attempts, type Nines } from './score';

export type Step = 'understand' | 'cause' | 'change' | 'verify';
export const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: 'understand', label: 'Understand', hint: 'Read the ticket: what people see, what is known, the goal.' },
  { id: 'cause', label: 'Find the cause', hint: 'Open the evidence and tap anything that looks wrong. Key findings are pinned to your notes.' },
  { id: 'change', label: 'Change', hint: 'Make one deliberate change to the real setting.' },
  { id: 'verify', label: 'Verify', hint: 'Run it for real and watch every check.' },
];

/** A piece of evidence that explains the cause, pinned to the case notes. */
export interface Finding {
  key: string;
  source: string;
  text: string;
  note: string;
}

export interface Case {
  spec: LevelSpec;
  started: boolean;
  /** Evidence the player has looked at ("evidenceId:index"). */
  seen: Set<string>;
  findings: Finding[];
  /** Config tickets: the settings as the player has them now. */
  cfg: Cfg;
  /** Terminal tickets: files and variables of the simulated machine. */
  term: TermState | undefined;
  /** Something was changed since the ticket opened (terminal tickets). */
  changed: boolean;
  attempts: Attempts;
  verdict: Verdict | undefined;
  solved: boolean;
}

const clone = <T>(v: T): T => structuredClone(v);

export function openCase(spec: LevelSpec): Case {
  return {
    spec,
    started: false,
    seen: new Set(),
    findings: [],
    cfg: spec.type === 'config' ? clone(spec.start) : {},
    term: spec.type === 'terminal' ? newTermState(spec.term) : undefined,
    changed: false,
    attempts: newAttempts(),
    verdict: undefined,
    solved: false,
  };
}

/** Where the player is in the four steps. */
export function stepOf(c: Case): Step {
  if (!c.started) return 'understand';
  if (c.solved) return 'verify';
  if (c.findings.length === 0 && !hasChanged(c)) return 'cause';
  return 'change';
}

export function hasChanged(c: Case): boolean {
  if (c.spec.type === 'terminal') return c.changed;
  return changedKeys(c).length > 0;
}

const same = (a: Value | undefined, b: Value | undefined): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Settings that differ from how the ticket started. */
export function changedKeys(c: Case): string[] {
  if (c.spec.type !== 'config') return [];
  const start = c.spec.start;
  return c.spec.fields.map((f) => f.key).filter((k) => !same(start[k], c.cfg[k]));
}

/** How many separate things in this ticket count as key evidence. */
export function evidenceTotal(spec: LevelSpec): number {
  let n = 0;
  for (const e of spec.evidence) {
    if (e.kind === 'log') n += e.lines.filter((l) => l.evidence).length;
    else if (e.kind === 'chart') n += e.bars.filter((b) => b.evidence).length;
    else if (e.kind === 'inspect') n += e.items.filter((i) => i.evidence).length;
    else if (e.kind === 'search') n += 1;
  }
  return n;
}

export interface Look {
  note: string;
  evidence: boolean;
  /** First time this exact thing was pinned. */
  pinned: boolean;
}

function pin(c: Case, f: Finding): boolean {
  if (c.findings.some((x) => x.key === f.key)) return false;
  c.findings.push(f);
  return true;
}

/** Tap a log line, chart bar or record. Returns what it means, and whether it explains the cause. */
export function inspect(c: Case, evidenceId: string, index: number): Look | undefined {
  const e = c.spec.evidence.find((x) => x.id === evidenceId);
  if (!e) return undefined;
  const key = `${evidenceId}:${index}`;
  let text: string;
  let note: string;
  let evidence: boolean;
  if (e.kind === 'log') {
    const l = e.lines[index];
    if (!l) return undefined;
    [text, note, evidence] = [l.text, l.note, !!l.evidence];
  } else if (e.kind === 'chart') {
    const b = e.bars[index];
    if (!b) return undefined;
    [text, note, evidence] = [`${b.label}: ${b.value}${e.unit ?? ''}`, b.note, !!b.evidence];
  } else if (e.kind === 'inspect') {
    const it = e.items[index];
    if (!it) return undefined;
    [text, note, evidence] = [`${it.title}: ${it.summary}`, it.detail, !!it.evidence];
  } else {
    return undefined;
  }
  c.seen.add(key);
  const pinned = evidence && pin(c, { key, source: e.label, text, note });
  return { note, evidence, pinned };
}

export interface SearchResult {
  hits: string[];
  total: number;
  /** The search surfaced the line that explains the cause. */
  found: boolean;
  pinned: boolean;
}

/** Filter a pile of log lines. Finding the telling line by searching for it counts as evidence. */
export function search(c: Case, evidenceId: string, query: string): SearchResult {
  const e = c.spec.evidence.find((x): x is Extract<Evidence, { kind: 'search' }> => x.id === evidenceId && x.kind === 'search');
  if (!e) return { hits: [], total: 0, found: false, pinned: false };
  const q = query.trim().toLowerCase();
  const hits = q ? e.lines.filter((l) => l.toLowerCase().includes(q)) : e.lines.slice(0, 8);
  const telling = q ? hits.find((l) => e.evidence.test(l)) : undefined;
  // Only a search narrow enough to be useful counts: at most half the pile.
  const narrow = hits.length <= Math.max(1, Math.ceil(e.lines.length / 2));
  const found = !!telling && narrow;
  const pinned = found && pin(c, { key: `${evidenceId}:search`, source: e.label, text: telling!, note: `Found by searching for "${query.trim()}".` });
  return { hits, total: e.lines.length, found, pinned };
}

export function setField(c: Case, key: string, value: Value): void {
  if (c.spec.type !== 'config' || c.solved) return;
  c.cfg = { ...c.cfg, [key]: value };
}

export function resetFields(c: Case): void {
  if (c.spec.type === 'config' && !c.solved) c.cfg = clone(c.spec.start);
}

export type ApplyResult =
  | { kind: 'no-change' }
  | { kind: 'failed'; verdict: Verdict }
  | { kind: 'solved'; verdict: Verdict; nines: Nines };

function noteGuess(c: Case): void {
  if (c.findings.length === 0) c.attempts.guessedFirst = true;
}

function settle(c: Case, v: Verdict): ApplyResult {
  c.verdict = v;
  if (passed(v)) {
    c.solved = true;
    if (v.wasteful) c.attempts.wasteful = true;
    return { kind: 'solved', verdict: v, nines: ninesFor(c.attempts) };
  }
  c.attempts.failedChanges += 1;
  return { kind: 'failed', verdict: v };
}

/** Config tickets: run the change for real. */
export function applyChange(c: Case): ApplyResult {
  if (c.spec.type !== 'config' || c.solved) return { kind: 'no-change' };
  if (changedKeys(c).length === 0) return { kind: 'no-change' };
  noteGuess(c);
  return settle(c, c.spec.verify(clone(c.cfg)));
}

export type CommandResult =
  | { kind: 'clear' }
  | { kind: 'edit'; path: string; content: string }
  | {
      kind: 'output';
      out: string;
      bad: boolean;
      evidence: boolean;
      pinned: boolean;
      /** Set when the command was a check: what the ticket's rules made of the system. */
      apply?: ApplyResult;
      /** A check ran before anything was changed. */
      idleCheck?: Verdict;
    };

/** Terminal tickets: run one line in the simulated shell. */
export function runCommand(c: Case, line: string): CommandResult {
  if (c.spec.type !== 'terminal' || !c.term) return { kind: 'output', out: '', bad: false, evidence: false, pinned: false };
  const o = run(c.spec.term, c.term, line);
  if (o.kind === 'clear') return { kind: 'clear' };
  if (o.kind === 'edit') return { kind: 'edit', path: o.path, content: c.term.files[o.path] ?? '' };
  const r = o.result;
  const pinned = !!r.evidence && pin(c, { key: `cmd:${line.trim()}`, source: `$ ${line.trim()}`, text: firstTellingLine(r.out), note: 'This output points at the cause.' });
  if (c.solved) return { kind: 'output', out: r.out, bad: !!r.bad, evidence: !!r.evidence, pinned };
  if (r.bad) c.attempts.failedChanges += 1;
  if (r.changed) {
    noteGuess(c);
    c.changed = true;
  }
  const res: CommandResult = { kind: 'output', out: r.out, bad: !!r.bad, evidence: !!r.evidence, pinned };
  if (r.verify) {
    const v = c.spec.check(c.term);
    if (c.changed) res.apply = passed(v) ? settle(c, v) : failedCheck(c, v);
    else res.idleCheck = v;
  }
  return res;
}

/**
 * A failing check in the terminal is free: checking after every change is good practice.
 * Only commands that make things worse cost a nine there.
 */
function failedCheck(c: Case, v: Verdict): ApplyResult {
  c.verdict = v;
  return { kind: 'failed', verdict: v };
}

function firstTellingLine(out: string): string {
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  return (lines.find((l) => /error|fail|denied|refused|timeout|expired|killed|✗|!\s*$/i.test(l)) ?? lines[0] ?? '').slice(0, 140);
}

/** Save a file from the editor. Returns true if it changed. */
export function saveEdit(c: Case, path: string, content: string): boolean {
  if (!c.term || c.solved) return false;
  const changed = saveFile(c.term, path, content);
  if (changed) {
    noteGuess(c);
    c.changed = true;
  }
  return changed;
}

/** Apply the intended fix through the same rules the player goes through (tests, and the dev shortcut). */
export function solveByTheBook(c: Case): ApplyResult {
  if (c.spec.type === 'config') {
    c.cfg = clone(c.spec.solution);
    return applyChange(c);
  }
  c.spec.solve(c.term!);
  c.changed = true;
  return settle(c, c.spec.check(c.term!));
}
