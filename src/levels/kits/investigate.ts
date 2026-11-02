/** Pure rules for the Investigate & Fix kit. */

export type ToolKind = 'investigate' | 'fix' | 'locked';

export interface ToolRule {
  id: string;
  kind: ToolKind;
  /** For fix tools: does this actually solve the incident? */
  resolves?: boolean;
  /** Trust lost when a wrong fix is used (default 3). */
  penalty?: number;
}

export interface InvestigateState {
  investigated: string[];
  resolved: boolean;
  trust: number;
  mistakes: number;
}

export type Outcome =
  | { type: 'info'; first: boolean }
  | { type: 'locked' }
  | { type: 'wrong'; trust: number }
  | { type: 'resolved'; trust: number; lucky: boolean }
  | { type: 'already-resolved' };

export const REWARD_INVESTIGATED = 5;
export const REWARD_LUCKY = 1;

export function newInvestigateState(): InvestigateState {
  return { investigated: [], resolved: false, trust: 0, mistakes: 0 };
}

export function useTool(tools: readonly ToolRule[], s: InvestigateState, id: string): { state: InvestigateState; outcome: Outcome } {
  const tool = tools.find((t) => t.id === id);
  if (!tool || tool.kind === 'locked') return { state: s, outcome: { type: 'locked' } };

  if (tool.kind === 'investigate') {
    const first = !s.investigated.includes(id);
    const investigated = first ? [...s.investigated, id] : s.investigated;
    return { state: { ...s, investigated }, outcome: { type: 'info', first } };
  }

  if (s.resolved) return { state: s, outcome: { type: 'already-resolved' } };

  if (tool.resolves) {
    const lucky = s.investigated.length === 0;
    const gain = lucky ? REWARD_LUCKY : REWARD_INVESTIGATED;
    return { state: { ...s, resolved: true, trust: s.trust + gain }, outcome: { type: 'resolved', trust: gain, lucky } };
  }

  const loss = tool.penalty ?? 3;
  return { state: { ...s, trust: s.trust - loss, mistakes: s.mistakes + 1 }, outcome: { type: 'wrong', trust: -loss } };
}
