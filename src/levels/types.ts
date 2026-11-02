import type { Ctx } from '../art/pixels';
import type { LevelMeta } from './catalog';
import type { ToolRule } from './kits/investigate';
import type { SortPuzzle } from './kits/sort';

/** The "what you just learned" card shown when a level is solved. */
export interface Lesson {
  headline: string;
  /** Plain-language mapping from the metaphor to the real thing. */
  mapping: [metaphor: string, real: string][];
  /** A peek at how this looks with real tools (shown as code). */
  realWorld: string;
  realWorldCaption: string;
}

export interface ToolOutput {
  title: string;
  /** Log-style lines. Prefix a line with "!" to mark it as an error. */
  lines?: string[];
  chart?: { values: number[]; limit: number; caption: string };
  text?: string;
}

export interface ToolDef extends ToolRule {
  icon: string;
  label: string;
  output: ToolOutput;
}

/** An animated scene the kit draws behind its UI. */
export interface Stage<S> {
  update(dt: number, t: number, state: S): void;
  render(c: Ctx, t: number, state: S): void;
  /** Optional live detail for the alert banner (e.g. a restart counter). */
  alertDetail?(): string;
}

export interface InvestigateLevel {
  meta: LevelMeta;
  briefing: { title: string; text: string };
  alert: string;
  tools: ToolDef[];
  resolvedText: { investigated: string; lucky: string };
  lesson: Lesson;
  makeStage(): Stage<{ resolved: boolean }>;
}

export interface SortLevel {
  meta: LevelMeta;
  briefing: { title: string; text: string };
  puzzle: SortPuzzle;
  /** Labels for items and slots shown in the UI. */
  itemLabel: Record<string, string>;
  slotLabel: Record<string, string>;
  wrongHint: string;
  lesson: Lesson;
  makeStage(): SortStage;
}

export interface SortStage extends Stage<{ assign: Record<string, string>; solved: boolean }> {
  /** Where each slot's drop target sits, as fractions of the 384x216 view. */
  slotRects: Record<string, { x: number; y: number; w: number; h: number }>;
}
