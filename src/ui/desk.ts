/** One ticket on the desk: the brief, the evidence, the change, the proof. */
import { analytics, secsSince, type Step as TrackStep } from '../analytics/analytics';
import { DISTRICTS, type LevelMeta } from '../curriculum/catalog';
import type { ConfigLevel, Evidence, Field, LevelSpec, TerminalLevel, Value, Verdict } from '../curriculum/spec';
import { applyChange, changedKeys, evidenceTotal, inspect, openCase, resetFields, runCommand, saveEdit, search, setField, stepOf, STEPS, type ApplyResult, type Case } from '../game/case';
import { trustFor } from '../game/score';
import type { TownState } from '../town/town';
import { actName, type App } from './app';
import { button, coarse, h, icon, put } from './dom';
import { showRecap } from './recap';
import { TownView } from './townview';

type Tab = 'ticket' | 'evidence' | 'change';

/** "Click lines." was written for a mouse. The interface says how to interact; keep only the content. */
const tidyHint = (s: string): string => s.replace(/\s*Click[^.]*\./g, '').trim();
const sentence = (s: string): string => (s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);
const show = (v: Value | undefined, f?: Field): string => {
  if (Array.isArray(v)) {
    const names = f && f.kind === 'order' ? v.map((x) => f.labels[x] ?? x) : f && f.kind === 'set' ? v.map((x) => f.options.find((o) => o[0] === x)?.[1] ?? x) : v;
    return names.length ? names.join(', ') : '(none)';
  }
  if (f && f.kind === 'choice') return f.options.find((o) => o[0] === v)?.[1] ?? String(v);
  if (f && f.kind === 'toggle') return v ? (f.on ?? 'on') : (f.off ?? 'off');
  return String(v ?? '');
};

export class Desk {
  readonly el: HTMLElement;
  private c: Case;
  private scene: TownView;
  private tab: Tab = 'ticket';
  private source: string;
  private openedAt = Date.now();
  private replay: boolean;
  private tracked = { cause: false, fix: false };
  private busy = false;
  private stepsEl = h('ol', 'steps');
  private notesEl = h('div', 'notes');
  private evidenceEl = h('div', 'ev-body');
  private changeEl = h('div', 'change-body');
  private boardEl = h('ul', 'status-tiles');
  private tabsEl = h('nav', { class: 'desk-tabs', 'aria-label': 'Ticket sections' });
  private termOut: HTMLElement | undefined;
  private history: string[] = [];
  private onHide = () => this.abandon('closed_tab');
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !this.el.querySelector('.sheet, .editor')) this.leave();
  };

  constructor(
    private app: App,
    private meta: LevelMeta,
    private spec: LevelSpec,
    private onClose: (then?: string) => void,
  ) {
    this.c = openCase(spec);
    this.replay = !!app.progress.solved[meta.id];
    this.source = spec.evidence[0]?.id ?? '';
    const district = DISTRICTS.find((d) => d.id === meta.district)!;

    this.scene = new TownView({ pins: false });
    this.scene.focus = { id: meta.district, mood: 'broken' };
    this.scene.calm = app.calm;
    this.scene.setState(this.sceneState());

    const head = h('header', 'desk-head',
      button('icon-btn', [icon('back'), h('span', 'btn-label', 'Town')], () => this.leave(), { 'aria-label': 'Back to town' }),
      h('div', 'desk-title', h('span', 'eyebrow', `${district.name} · ticket ${meta.num} · ${actName(meta)}`), h('h1', '', meta.title)),
      this.stepsEl,
    );

    const brief = h('section', { class: 'col col-brief', 'data-tab': 'ticket' },
      h('div', 'scene', this.scene.el, h('div', 'scene-alert', icon('bell', 15), h('span', '', sentence(spec.alert))), this.boardEl),
      this.paperTicket(),
      h('div', 'paper notes-card', h('h2', 'paper-h', icon('pin', 15), 'Case notes'), this.notesEl),
    );
    const isTerm = spec.type === 'terminal';
    const evidence = h('section', { class: 'col col-evidence', 'data-tab': 'evidence' }, this.evidenceEl);
    const change = h('section', { class: 'col col-change', 'data-tab': 'change' }, this.changeEl);
    const body = h('div', { class: 'desk-body', 'data-kind': spec.type }, brief, evidence, change);

    const labels: [Tab, string][] = [['ticket', 'Ticket'], ['evidence', isTerm ? 'Handbook' : 'Evidence'], ['change', isTerm ? 'Terminal' : 'Change']];
    for (const [id, label] of labels) this.tabsEl.append(button('desk-tab', label, () => this.setTab(id), { 'data-tab': id }));

    this.el = h('div', { class: 'desk', tabindex: '-1', 'data-tab': this.tab }, head, this.tabsEl, body);
    this.renderAll();
    this.intro();
    this.scene.start();
    window.addEventListener('pagehide', this.onHide);
    window.addEventListener('keydown', this.onKey);
    analytics.track({ name: 'ticket_open', level: meta.id, replay: this.replay });
  }

  destroy(): void {
    this.scene.destroy();
    window.removeEventListener('pagehide', this.onHide);
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }

  // ---------------------------------------------------------------- shell

  private sceneState(): TownState {
    const districts = {} as TownState['districts'];
    for (const d of DISTRICTS) districts[d.id] = { lit: 0.35, open: false };
    return { districts, nines: 3 };
  }

  private setTab(t: Tab): void {
    this.tab = t;
    this.el.dataset.tab = t;
    for (const b of this.tabsEl.children) b.classList.toggle('on', (b as HTMLElement).dataset.tab === t);
    this.el.querySelector('.desk-body')!.scrollTop = 0;
    for (const col of this.el.querySelectorAll('.col')) col.scrollTop = 0;
  }

  private renderAll(): void {
    this.renderSteps();
    this.renderBoard();
    this.renderNotes();
    this.renderEvidence();
    this.renderChange();
    this.setTab(this.tab);
  }

  private renderSteps(): void {
    const cur = stepOf(this.c);
    const idx = STEPS.findIndex((s) => s.id === cur);
    this.stepsEl.replaceChildren(
      ...STEPS.map((s, i) => {
        const done = this.c.solved || i < idx;
        return h('li', { class: done ? 'done' : i === idx ? 'now' : '', title: s.hint }, h('span', 'step-n', done ? icon('check', 13) : String(i + 1)), h('span', 'step-l', s.label));
      }),
    );
    const tabs = this.tabsEl.children;
    (tabs[1] as HTMLElement | undefined)?.classList.toggle('nudge', cur === 'cause' && this.spec.type === 'config');
    (tabs[2] as HTMLElement | undefined)?.classList.toggle('nudge', cur === 'change' || (cur === 'cause' && this.spec.type === 'terminal'));
  }

  private renderBoard(): void {
    const lines = this.c.solved ? this.spec.board.fixed : this.spec.board.broken;
    this.boardEl.className = `status-tiles ${this.c.solved ? 'ok' : 'bad'}`;
    put(this.boardEl, ...lines.map((l) => h('li', '', l.replace(/\s*✓$/, ''))));
  }

  private paperTicket(): HTMLElement {
    const i = this.spec.intro;
    return h('article', 'paper ticket',
      h('h2', 'paper-h', 'What people see'),
      h('p', 'lede', i.symptom),
      h('h2', 'paper-h', 'What we know'),
      h('ul', 'known', ...i.known.map((k) => h('li', '', k))),
      h('h2', 'paper-h', 'Goal'),
      h('p', 'goal', i.goal),
    );
  }

  private intro(): void {
    const i = this.spec.intro;
    const start = () => {
      this.c.started = true;
      sheet.remove();
      this.renderSteps();
      this.setTab(coarse() || window.innerWidth < 1000 ? 'ticket' : this.tab);
      analytics.track({ name: 'ticket_start', level: this.meta.id, replay: this.replay });
    };
    const sheet = h('div', 'sheet intro',
      h('div', 'sheet-card paper',
        h('div', 'page-line', icon('bell', 16), h('span', '', sentence(this.spec.alert))),
        h('h2', 'intro-title', this.meta.title),
        h('p', 'lede', i.symptom),
        h('p', 'goal', h('b', '', 'Goal. '), i.goal),
        h('ol', 'intro-steps', ...STEPS.slice(1).map((s) => h('li', '', h('b', '', s.label), h('span', '', s.hint)))),
        h('div', 'sheet-actions',
          button('btn ink primary', 'Take the page', () => {
            this.app.sound.play('tap');
            start();
          }),
          button('btn ink ghost', 'Not now', () => this.leave()),
        ),
      ),
    );
    this.el.append(sheet);
    this.app.sound.play('page');
  }

  private toast(text: string, kind: 'bad' | 'good' | 'info' = 'info'): void {
    this.el.querySelector('.toast')?.remove();
    const t = h('div', { class: `toast ${kind}`, role: 'status' }, text);
    this.el.append(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ---------------------------------------------------------------- notes

  private renderNotes(): void {
    const total = evidenceTotal(this.spec);
    if (!this.c.findings.length) {
      put(this.notesEl, h('p', 'empty', this.spec.type === 'terminal' ? 'Nothing pinned yet. Run commands; output that explains the problem is pinned here.' : 'Nothing pinned yet. Open the evidence and tap whatever looks wrong.'));
      return;
    }
    put(
      this.notesEl,
      ...this.c.findings.map((f) => h('div', 'finding', h('span', 'f-src', f.source), h('code', 'f-text', f.text), h('p', 'f-note', f.note))),
      total > this.c.findings.length && this.spec.type === 'config' ? h('p', 'empty', `${this.c.findings.length} of ${total} key findings. You have enough to act; the rest sharpen the picture.`) : null,
    );
  }

  private pinned(): void {
    this.app.sound.play('pin');
    this.renderNotes();
    this.renderSteps();
    this.toast('Pinned to your case notes', 'good');
    if (!this.tracked.cause) {
      this.tracked.cause = true;
      analytics.track({ name: 'ticket_step', level: this.meta.id, replay: this.replay, step: 'cause', secs: this.secs() });
    }
  }

  private secs(): number {
    return secsSince(this.openedAt, Date.now());
  }

  // ---------------------------------------------------------------- evidence

  private renderEvidence(): void {
    const ev = this.spec.evidence;
    if (!ev.length) {
      put(this.evidenceEl, h('p', 'empty', 'No handbook for this one. The terminal has everything: start with "help".'));
      return;
    }
    const tabs = h('div', { class: 'src-tabs', role: 'tablist' },
      ...ev.map((e) => button(`src-tab ${e.id === this.source ? 'on' : ''}`, sentence(e.label), () => {
        this.source = e.id;
        this.app.sound.play('tap');
        this.renderEvidence();
      }, { role: 'tab', 'aria-selected': String(e.id === this.source) })),
    );
    const e = ev.find((x) => x.id === this.source) ?? ev[0];
    const hint = 'hint' in e ? tidyHint(e.hint) : '';
    put(this.evidenceEl, ev.length > 1 ? tabs : h('div', 'src-single', sentence(e.label)), hint ? h('p', 'src-hint', hint) : null, this.source_(e));
  }

  private note(text: string, evidence: boolean): HTMLElement {
    return h('div', `annot ${evidence ? 'key' : ''}`, evidence ? h('span', 'annot-tag', icon('pin', 13), 'Key finding') : null, h('p', '', text));
  }

  private look(e: Evidence, i: number): void {
    const r = inspect(this.c, e.id, i);
    if (!r) return;
    this.open_ = `${e.id}:${i}`;
    if (r.pinned) this.pinned();
    else this.app.sound.play('tap');
    this.renderEvidence();
  }

  /** The line, bar or record whose note is showing. */
  private open_ = '';

  private source_(e: Evidence): HTMLElement {
    const key = (i: number) => `${e.id}:${i}`;
    const isKey = (i: number) => this.c.findings.some((f) => f.key === key(i));
    if (e.kind === 'log') {
      const list = h('div', { class: `log ${e.diff ? 'diff' : ''}` });
      e.lines.forEach((l, i) => {
        const sign = e.diff ? (l.text.trim().match(/^(-\/\+|[+\-~])/)?.[1] ?? '') : '';
        const row = button(`log-line ${this.c.seen.has(key(i)) ? 'seen' : ''} ${isKey(i) ? 'key' : ''} ${sign === '+' ? 'add' : sign === '-' ? 'del' : sign ? 'chg' : ''}`, [l.t ? h('time', '', l.t) : null, h('span', 'log-text', l.text)], () => this.look(e, i));
        list.append(row);
        if (this.open_ === key(i)) list.append(this.note(l.note, !!l.evidence));
      });
      return list;
    }
    if (e.kind === 'chart') {
      const max = Math.max(...e.bars.map((b) => b.value), e.limit?.value ?? 0) * 1.12 || 1;
      const plot = h('div', 'chart-bars');
      const labels = h('div', 'chart-labels');
      e.bars.forEach((b, i) => {
        const over = e.limit !== undefined && b.value > e.limit.value;
        const pct = Math.max(2, (b.value / max) * 100);
        plot.append(button(`bar ${this.c.seen.has(key(i)) ? 'seen' : ''} ${isKey(i) ? 'key' : ''} ${over ? 'over' : ''} ${this.open_ === key(i) ? 'sel' : ''}`,
          [h('span', { class: 'bar-fill', style: `height:${pct}%` }), h('span', { class: 'bar-val', style: `bottom:${pct}%` }, `${b.value}`)],
          () => this.look(e, i), { 'aria-label': `${b.label}: ${b.value}${e.unit ?? ''}` }));
        labels.append(h('span', this.open_ === key(i) ? 'sel' : '', b.label));
      });
      if (e.limit) plot.append(h('div', { class: 'chart-limit', style: `bottom:${(e.limit.value / max) * 100}%` }, h('span', '', sentence(e.limit.label))));
      const openIdx = e.bars.findIndex((_b, i) => this.open_ === key(i));
      const unit = (e.unit ?? '').trim();
      return h('div', 'chart', unit ? h('div', 'chart-unit', unit === '%' ? 'percent' : unit) : null, plot, labels, openIdx >= 0 ? this.note(e.bars[openIdx].note, !!e.bars[openIdx].evidence) : h('p', 'src-hint', 'Tap a bar to read it.'));
    }
    if (e.kind === 'inspect') {
      const list = h('div', 'records');
      e.items.forEach((it, i) => {
        list.append(button(`record ${this.c.seen.has(key(i)) ? 'seen' : ''} ${isKey(i) ? 'key' : ''}`, [h('span', 'rec-title', it.title), h('span', 'rec-sum', it.summary)], () => this.look(e, i)));
        if (this.open_ === key(i)) list.append(this.note(it.detail, !!it.evidence));
      });
      return list;
    }
    if (e.kind === 'search') {
      const out = h('div', 'log search-out');
      const count = h('p', 'src-hint');
      const input = h('input', { class: 'field-input mono', type: 'search', placeholder: e.placeholder, value: this.query, 'aria-label': 'Search the logs', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false' });
      const run = () => {
        this.query = input.value;
        const r = search(this.c, e.id, this.query);
        count.textContent = this.query.trim() ? `${r.hits.length} of ${r.total} lines match.` : `${r.total} lines. Showing the first ${r.hits.length}. Search to narrow them down.`;
        put(out, ...r.hits.slice(0, 60).map((l) => h('div', `log-line static ${e.evidence.test(l) && r.found ? 'key' : ''}`, h('span', 'log-text', l))));
        if (r.pinned) this.pinned();
      };
      input.addEventListener('input', run);
      run();
      return h('div', 'search', h('label', 'search-box', icon('search', 16), input), count, out);
    }
    return h('pre', 'doc', e.text);
  }

  private query = '';

  // ---------------------------------------------------------------- change: config

  private renderChange(): void {
    if (this.spec.type === 'config') this.renderConfig(this.spec);
    else if (!this.termOut) this.buildTerminal(this.spec);
  }

  private renderConfig(spec: ConfigLevel): void {
    const form = h('div', 'form');
    for (const f of spec.fields) form.append(this.field(f));
    const keys = changedKeys(this.c);
    const diff = h('div', 'diffbox', h('div', 'diff-h', 'Your change'));
    if (!keys.length) diff.append(h('p', 'empty', 'Nothing changed yet.'));
    for (const k of keys) {
      const f = spec.fields.find((x) => x.key === k)!;
      diff.append(h('div', 'diff-line del', `- ${f.label}: ${show(spec.start[k], f)}`), h('div', 'diff-line add', `+ ${f.label}: ${show(this.c.cfg[k], f)}`));
    }
    const warn = keys.length && !this.c.findings.length && !this.c.solved ? h('p', 'hunch', 'No evidence pinned yet. A change made on a hunch costs a nine.') : null;
    const apply = button('btn primary wide', sentence(spec.applyLabel), () => void this.apply(), { disabled: this.c.solved || this.busy });
    const reset = keys.length && !this.c.solved ? button('link', [icon('redo', 14), 'Undo my changes'], () => {
      resetFields(this.c);
      this.renderChange();
    }) : null;
    const results = this.resultsEl ?? (this.resultsEl = h('div', 'results'));
    put(this.changeEl, h('div', 'cfg-title', h('span', 'k', 'Change request'), h('code', '', spec.configTitle.toLowerCase())), form, diff, warn, h('div', 'apply-row', apply, reset), results);
  }

  private resultsEl: HTMLElement | undefined;

  private set(f: Field, v: Value, rerender = true): void {
    setField(this.c, f.key, v);
    if (rerender) this.renderChange();
  }

  private field(f: Field): HTMLElement {
    const v = this.c.cfg[f.key];
    const off = this.c.solved;
    const changed = changedKeys(this.c).includes(f.key);
    const wrap = h('div', `field ${changed ? 'changed' : ''}`, h('label', 'field-label', f.label));
    if (f.kind === 'number') {
      const step = f.step ?? 1;
      const clamp = (n: number) => Math.max(f.min, Math.min(f.max, Number.isFinite(n) ? n : f.min));
      const input = h('input', { class: 'field-input mono num', type: 'number', inputmode: 'decimal', min: f.min, max: f.max, step, value: String(v), disabled: off, 'aria-label': f.label });
      input.addEventListener('change', () => this.set(f, clamp(Number(input.value))));
      const bump = (d: number) => this.set(f, clamp(Math.round((Number(this.c.cfg[f.key]) + d) / step) * step));
      wrap.append(h('div', 'stepper', button('step-btn', '−', () => bump(-step), { disabled: off, 'aria-label': `Lower ${f.label}` }), input, button('step-btn', '+', () => bump(step), { disabled: off, 'aria-label': `Raise ${f.label}` }), f.unit ? h('span', 'unit', f.unit) : null));
    } else if (f.kind === 'choice') {
      const long = f.options.length > 4 || f.options.some((o) => o[1].length > 16);
      wrap.append(h('div', { class: long ? 'choices list' : 'choices', role: 'radiogroup', 'aria-label': f.label },
        ...f.options.map(([val, label]) => button(`choice ${v === val ? 'on' : ''}`, label, () => this.set(f, val), { role: 'radio', 'aria-checked': String(v === val), disabled: off }))));
    } else if (f.kind === 'toggle') {
      wrap.append(button(`toggle ${v ? 'on' : ''}`, [h('span', 'toggle-knob'), h('span', 'toggle-text', v ? (f.on ?? 'On') : (f.off ?? 'Off'))], () => this.set(f, !v), { role: 'switch', 'aria-checked': String(!!v), disabled: off }));
    } else if (f.kind === 'text') {
      const input = h('input', { class: 'field-input mono', type: 'text', value: String(v ?? ''), placeholder: f.placeholder ?? '', disabled: off, autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', 'aria-label': f.label });
      input.addEventListener('input', () => this.set(f, input.value, false));
      input.addEventListener('change', () => this.renderChange());
      wrap.append(input);
    } else if (f.kind === 'set') {
      const cur = Array.isArray(v) ? v : [];
      wrap.append(h('div', 'choices list',
        ...f.options.map(([val, label]) => button(`choice check ${cur.includes(val) ? 'on' : ''}`, [h('span', 'box', cur.includes(val) ? icon('check', 13) : null), label],
          () => this.set(f, cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]), { role: 'checkbox', 'aria-checked': String(cur.includes(val)), disabled: off }))));
    } else {
      const cur = Array.isArray(v) ? v : [];
      const move = (i: number, d: number) => {
        const next = [...cur];
        [next[i], next[i + d]] = [next[i + d], next[i]];
        this.set(f, next);
      };
      wrap.append(h('ol', 'order',
        ...cur.map((id, i) => h('li', '', h('span', 'order-n', String(i + 1)), h('span', 'order-text', f.labels[id] ?? id),
          button('step-btn sm', icon('up', 15), () => move(i, -1), { disabled: off || i === 0, 'aria-label': 'Move up' }),
          button('step-btn sm', icon('down', 15), () => move(i, 1), { disabled: off || i === cur.length - 1, 'aria-label': 'Move down' })))));
    }
    return wrap;
  }

  private async apply(): Promise<void> {
    if (this.busy) return;
    const r = applyChange(this.c);
    if (r.kind === 'no-change') {
      this.toast('Nothing has changed yet. Adjust a setting first.');
      return;
    }
    this.afterAttempt(r);
    this.busy = true;
    this.renderChange();
    await this.playVerdict(r.verdict, this.resultsEl!);
    this.busy = false;
    this.settle(r);
  }

  /** Bookkeeping that must happen the instant the rules have spoken, before any animation. */
  private afterAttempt(r: Exclude<ApplyResult, { kind: 'no-change' }>): void {
    const id = this.meta.id;
    if (!this.tracked.fix) {
      this.tracked.fix = true;
      analytics.track({ name: 'ticket_step', level: id, replay: this.replay, step: 'fix', secs: this.secs() });
    }
    if (r.kind === 'solved') {
      this.app.ticketSolved(id, r.nines);
      const a = this.c.attempts;
      analytics.track({ name: 'ticket_solved', level: id, replay: this.replay, secs: this.secs(), misses: a.failedChanges, trust: trustFor(a), guessedFirst: a.guessedFirst, wasteful: a.wasteful });
    } else {
      analytics.track({ name: 'ticket_miss', level: id, replay: this.replay, misses: this.c.attempts.failedChanges, secs: this.secs() });
    }
  }

  private async playVerdict(v: Verdict, into: HTMLElement): Promise<void> {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, this.app.calm ? 0 : ms));
    const list = h('ul', 'checks');
    put(into, h('div', 'diff-h', 'Running it for real'), list);
    into.scrollIntoView?.({ block: 'nearest', behavior: this.app.calm ? 'auto' : 'smooth' });
    for (const cs of v.cases) {
      const li = h('li', 'check run', h('span', 'check-ic'), h('span', '', cs.label));
      list.append(li);
      await wait(480);
      li.className = `check ${cs.pass ? 'pass' : 'fail'}`;
      li.firstChild!.replaceWith(h('span', 'check-ic', icon(cs.pass ? 'check' : 'cross', 14)));
      this.app.sound.play(cs.pass ? 'pass' : 'fail');
      await wait(160);
    }
  }

  private settle(r: Exclude<ApplyResult, { kind: 'no-change' }>): void {
    if (r.kind === 'failed') {
      this.resultsEl?.append(h('div', 'hintbox', h('b', '', 'Not fixed yet.'), ' ', r.verdict.hint ?? 'Look at which checks failed.'));
      this.toast('That change did not fix it · one nine lost', 'bad');
      this.renderChange();
      this.renderSteps();
      return;
    }
    this.solved(r);
  }

  private solved(r: Extract<ApplyResult, { kind: 'solved' }>): void {
    this.scene.focus = { id: this.meta.district, mood: 'fixed' };
    this.scene.setState(this.sceneState());
    this.app.sound.play('solved');
    this.renderBoard();
    this.renderSteps();
    if (this.spec.type === 'config') this.renderChange();
    setTimeout(() => showRecap(this.el, this.app, this.meta, this.spec, this.c, r.nines, (then) => this.onClose(then)), this.app.calm ? 0 : 1100);
  }

  // ---------------------------------------------------------------- change: terminal

  private buildTerminal(spec: TerminalLevel): void {
    const out = (this.termOut = h('div', { class: 'term-out', role: 'log', 'aria-live': 'polite' }));
    const input = h('input', { class: 'term-input', type: 'text', 'aria-label': 'Command', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: 'type a command, or tap one below' });
    let hist = -1;
    const submit = () => {
      const line = input.value;
      input.value = '';
      hist = -1;
      if (line.trim()) this.exec(spec, line);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      else if (e.key === 'ArrowUp' && this.history.length) {
        hist = Math.min(this.history.length - 1, hist + 1);
        input.value = this.history[this.history.length - 1 - hist];
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        hist = Math.max(-1, hist - 1);
        input.value = hist < 0 ? '' : this.history[this.history.length - 1 - hist];
        e.preventDefault();
      }
    });
    const fill = (cmd: string) => {
      input.value = cmd;
      this.app.sound.play('tap');
      if (!coarse()) input.focus();
      run.classList.add('ready');
    };
    const run = button('btn primary term-run', 'Run', () => {
      run.classList.remove('ready');
      submit();
    });
    const chips = h('div', 'chips');
    const group = (label: string, cmds: string[]) => chips.append(h('span', 'chip-label', label), ...cmds.map((cmd) => button('chip', cmd, () => fill(cmd))));
    group('This machine', spec.term.commands.map((cmd) => cmd.usage));
    group('Files', ['ls', ...Object.keys(spec.term.files).flatMap((f) => [`cat ${f}`, `edit ${f}`]), 'help']);
    this.print(spec.term.motd, 'sys');
    this.print('Tap a command to load it, then Run. Or type: "help" lists everything.', 'sys');
    put(this.changeEl, h('div', 'terminal', out, h('div', 'term-row', h('span', 'prompt', `${spec.term.host} $`), input, run)), chips);
    out.addEventListener('click', () => !coarse() && !String(getSelection()) && input.focus());
  }

  private print(text: string, cls = ''): void {
    if (!this.termOut) return;
    for (const line of text.split('\n')) this.termOut.append(h('div', `tl ${cls}`, line || ' '));
    this.termOut.scrollTop = this.termOut.scrollHeight;
  }

  private exec(spec: TerminalLevel, line: string): void {
    this.history.push(line);
    this.print(`${spec.term.host} $ ${line}`, 'cmd');
    const wasChanged = this.c.changed;
    const r = runCommand(this.c, line);
    if (r.kind === 'clear') return this.termOut!.replaceChildren();
    if (r.kind === 'edit') return this.editor(r.path, r.content);
    if (r.out) this.print(r.out, r.bad ? 'err' : r.evidence ? 'ev' : '');
    if (r.pinned) this.pinned();
    if (r.bad) {
      this.toast('That made things worse · one nine lost', 'bad');
      this.app.sound.play('fail');
    }
    if (!wasChanged && this.c.changed) this.changedOnce();
    const verdict = r.apply && r.apply.kind !== 'no-change' ? r.apply.verdict : r.idleCheck;
    if (verdict) for (const cs of verdict.cases) this.print(`${cs.pass ? '✓' : '✗'} ${cs.label}`, cs.pass ? 'ok' : 'err');
    if (r.apply?.kind === 'failed' && r.apply.verdict.hint) this.print(`hint: ${r.apply.verdict.hint}`, 'sys');
    if (r.apply?.kind === 'solved') {
      this.afterAttempt(r.apply);
      this.print('All checks pass. Verified.', 'ok');
      this.solved(r.apply);
    }
    this.renderSteps();
  }

  private changedOnce(): void {
    if (this.tracked.fix) return;
    this.tracked.fix = true;
    analytics.track({ name: 'ticket_step', level: this.meta.id, replay: this.replay, step: 'fix', secs: this.secs() });
    if (this.c.attempts.guessedFirst) this.toast('Changed before finding evidence · one nine lost', 'bad');
  }

  private editor(path: string, content: string): void {
    const ta = h('textarea', { class: 'editor-text', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': `Editing ${path}` });
    ta.value = content;
    const close = () => ed.remove();
    const save = () => {
      const wasChanged = this.c.changed;
      const changed = saveEdit(this.c, path, ta.value);
      this.print(changed ? `saved ${path}` : `${path}: no changes`, 'sys');
      if (changed && !wasChanged) this.changedOnce();
      this.renderSteps();
      close();
    };
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        save();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      }
    });
    const ed = h('div', 'editor',
      h('div', 'editor-card',
        h('div', 'editor-head', h('code', '', path), h('span', 'dim', 'Edit the file, then save. Reload or restart afterwards if the service needs it.')),
        ta,
        h('div', 'sheet-actions', button('btn primary', 'Save', save), button('btn ghost', 'Cancel', close)),
      ),
    );
    this.el.append(ed);
    ta.focus();
  }

  // ---------------------------------------------------------------- leaving

  private reached(): TrackStep {
    if (!this.c.started) return 'intro';
    if (this.tracked.fix) return 'fix';
    if (this.c.findings.length) return 'cause';
    return 'understand';
  }

  private abandon(how: 'left' | 'closed_tab'): void {
    if (this.c.solved) return;
    analytics.track({ name: 'ticket_abandon', level: this.meta.id, replay: this.replay, secs: this.secs(), misses: this.c.attempts.failedChanges, reached: this.reached(), how });
  }

  private leave(): void {
    this.abandon('left');
    this.onClose();
  }
}
