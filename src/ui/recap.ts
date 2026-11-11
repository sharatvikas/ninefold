/** The postmortem shown when a ticket is closed: what changed, why it worked, and the same fix with real tools. */
import type { LevelMeta } from '../curriculum/catalog';
import { MEANS } from '../curriculum/glossary';
import type { LevelSpec, Side } from '../curriculum/spec';
import type { Case } from '../game/case';
import { levelStatus, nextOpenAfter, townNines, uptimeLabel } from '../game/progress';
import { lessons, type Nines } from '../game/score';
import type { App } from './app';
import { button, h, icon } from './dom';

const GRADE: Record<Nines, string> = { 3: 'Three nines. A clean fix.', 2: 'Two nines. Fixed, with one misstep.', 1: 'One nine. Fixed the hard way.' };
const ISSUES = 'https://github.com/sharatvikas/ninefold/issues/new';

/** Real-tool snippets are shown as a diff: lines starting with + or - are coloured. */
export function codeBlock(text: string): HTMLElement {
  const pre = h('pre', 'code');
  for (const line of text.split('\n')) {
    const t = line.trimStart();
    const cls = /^\+/.test(t) ? 'add' : /^-(?!-)/.test(t) ? 'del' : /^[#$]/.test(t) ? (t.startsWith('$') ? 'cmd' : 'com') : '';
    pre.append(h('span', `cl ${cls}`, line || ' '), '\n');
  }
  return pre;
}

function side(label: string, s: Side, ok: boolean): HTMLElement {
  return h('div', `side ${ok ? 'ok' : 'bad'}`, h('span', 'k', label), h('pre', 'mini', s.lines.join('\n')), h('p', 'outcome', icon(ok ? 'check' : 'cross', 14), s.outcome.replace(/\s*✓$/, '')));
}

export function showRecap(root: HTMLElement, app: App, meta: LevelMeta, spec: LevelSpec, c: Case, nines: Nines, onClose: (then?: string) => void): void {
  const r = spec.recap;
  const after = spec.type === 'config' ? spec.recap.after(c.cfg) : spec.recap.after(c.term!);
  const real = typeof r.real === 'string' ? r.real : spec.type === 'config' ? (r.real as (s: typeof c.cfg) => string)(c.cfg) : (r.real as (s: NonNullable<typeof c.term>) => string)(c.term!);
  const lamps = h('div', { class: 'grade-lamps', role: 'img', 'aria-label': `${nines} of 3 nines` }, ...[1, 2, 3].map((i) => h('i', { class: i <= nines ? 'on' : '', style: `animation-delay:${i * 0.22}s` })));
  const lost = lessons(c.attempts);
  const next = nextOpenAfter(app.progress, meta.id);
  const best = app.progress.solved[meta.id]?.nines ?? nines;
  const issue = `${ISSUES}?title=${encodeURIComponent(`Ticket feedback: ${meta.title} (${meta.id})`)}`;

  const card = h('article', 'sheet-card paper recap',
    h('p', 'eyebrow ink', `Postmortem · ${meta.title}`),
    h('div', 'grade', lamps, h('div', '', h('p', 'grade-text', GRADE[nines]), h('p', 'grade-sub', `Town uptime is now ${uptimeLabel(townNines(app.progress))}.${best > nines ? ` Your best on this ticket stays at ${best} nines.` : ''}`))),
    h('h2', 'recap-headline', r.headline),
    h('div', 'sides', side('Before', r.before, false), h('span', 'sides-arrow', icon('arrow', 20)), side('After', after, true)),
    h('h3', 'paper-h', 'Why it worked'),
    h('p', 'why', r.why),
    h('h3', 'paper-h', `The same fix with real tools · ${meta.concept}`),
    codeBlock(real),
    h('p', 'caption', r.realCaption),
    lost.length ? h('div', 'lessons', h('h3', 'paper-h', nines === 3 ? 'Notes' : 'Where the nines went'), h('ul', '', ...lost.map((l) => h('li', '', l))), h('p', 'caption', 'Replay the ticket any time to raise its grade.')) : null,
    h('p', 'runbook-added', icon('book', 15), h('span', '', h('b', '', `${meta.concept}. `), MEANS[meta.id] ?? '', ' Added to your runbook.')),
    h('div', 'sheet-actions',
      next && levelStatus(app.progress, next) === 'open' ? button('btn ink primary', [`Next: ${next.title}`, icon('arrow', 16)], () => onClose(next.id)) : null,
      button('btn ink ghost', 'Back to town', () => onClose()),
      h('a', { class: 'link ink', href: issue, target: '_blank', rel: 'noopener' }, 'Something confusing or wrong? Tell me'),
    ),
  );
  const sheet = h('div', { class: 'sheet recap-sheet', role: 'dialog', 'aria-label': 'Postmortem' }, card);
  root.append(sheet);
  (card.querySelector('.btn') as HTMLElement | null)?.focus({ preventScroll: true });
}
