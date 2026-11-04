import { Backdrop, type Status } from '../art/backdrops';
import type { Ctx } from '../art/pixels';
import type { Game } from '../engine/game';
import { h } from '../ui/ui';
import { getLevel } from './catalog';
import { IncidentScene, type Exit, type Intro, type Recap, type Tab } from './incident';
import { passed, type Cfg, type ConfigLevel, type Evidence, type Field, type LevelSpec, type RecapSpec, type Side, type TerminalLevel, type Value, type Verdict } from './spec';
import { newTermState, run, saveFile, type TermState } from './terminal';
import { VIGNETTES } from './content/vignettes';

const CHANGE_TAB = 'change';
const TERM_TAB = 'terminal';

export class SpecScene extends IncidentScene {
  private backdrop: Backdrop;
  private status: Status = 'broken';
  private cfg: Cfg = {};
  private draft: Cfg = {};
  private term: TermState | undefined;
  private termLines: { text: string; cls: string }[] = [];
  private history: string[] = [];
  private histIdx = -1;
  private seen = new Set<string>();
  private searchQuery = '';
  private results: { label: string; pass: boolean }[] = [];
  private busy = false;
  private changedSinceStart = false;

  constructor(
    game: Game,
    private spec: LevelSpec,
    exit: Exit,
  ) {
    super(game, getLevel(spec.id), exit);
    this.backdrop = new Backdrop(this.meta.district, VIGNETTES[spec.id]);
    if (spec.type === 'config') {
      this.cfg = clone(spec.start);
      this.draft = clone(spec.start);
    } else {
      this.term = newTermState(spec.term);
      this.termLines = spec.term.motd.split('\n').map((text) => ({ text, cls: 'sys' }));
      this.termLines.push({ text: 'Type "help" to see the commands you can use.', cls: 'sys' });
    }
  }

  enter(): void {
    super.enter();
    this.root.classList.add(this.spec.type === 'terminal' ? 'tall' : 'mid');
  }

  protected intro(): Intro {
    return this.spec.intro;
  }

  protected tabs(): Tab[] {
    const ev: Tab[] = this.spec.evidence.map((e) => ({ id: e.id, icon: e.icon, label: e.label }));
    if (this.spec.type === 'config') return [...ev, { id: CHANGE_TAB, icon: '⚙️', label: 'CHANGE' }];
    return [{ id: TERM_TAB, icon: '⌨️', label: 'TERMINAL' }, ...ev];
  }

  protected renderTab(id: string): Node {
    if (id === CHANGE_TAB && this.spec.type === 'config') return this.configTab(this.spec);
    if (id === TERM_TAB && this.spec.type === 'terminal') return this.terminalTab(this.spec);
    const e = this.spec.evidence.find((x) => x.id === id);
    return e ? this.evidenceTab(e) : h('div');
  }

  // ---------------------------------------------------------------- evidence
  private found(): void {
    if (!this.steps.cause) {
      this.complete('cause');
      this.game.ui.toast('CAUSE FOUND', 'good');
    }
  }

  private evidenceTab(e: Evidence): Node {
    const wrap = h('div', 'evidence');
    if (e.kind === 'doc') {
      wrap.append(h('div', 'doc', e.text));
      return wrap;
    }
    wrap.append(h('div', 'hint', e.hint));
    if (e.kind === 'log') {
      e.lines.forEach((l, i) => {
        const key = `${e.id}:${i}`;
        const cls = e.diff ? ` diff ${/^[-]/.test(l.text) ? 'minus' : /^\+/.test(l.text) ? 'plus' : /^[~!]/.test(l.text) ? 'tilde' : ''}` : '';
        const row = h('div', `logline${cls} ${this.seen.has(key) ? 'pinned' : ''} ${l.evidence && this.seen.has(key) ? 'err' : ''}`);
        if (l.t) row.append(h('span', 'time', l.t));
        row.append(h('span', '', l.text));
        row.addEventListener('click', () => {
          this.seen.add(key);
          row.classList.add('pinned');
          if (l.evidence) {
            row.classList.add('err');
            this.found();
          }
          this.say(l.note, l.evidence ? 'good' : 'info');
        });
        wrap.append(row);
      });
    } else if (e.kind === 'chart') {
      const max = Math.max(...e.bars.map((b) => b.value), e.limit?.value ?? 0) * 1.15 || 1;
      const chart = h('div', 'chart big');
      const labels = h('div', 'chart-labels');
      e.bars.forEach((b, i) => {
        const key = `${e.id}:${i}`;
        const bar = h('button', `bar-btn ${b.evidence ? 'hot' : ''} ${this.seen.has(key) ? 'seen' : ''}`);
        bar.style.height = `${Math.max(2, (b.value / max) * 100)}%`;
        bar.append(h('span', 'v', this.seen.has(key) ? fmt(b.value, e.unit) : ''));
        bar.addEventListener('click', () => {
          this.seen.add(key);
          bar.classList.add('seen');
          (bar.firstChild as HTMLElement).textContent = fmt(b.value, e.unit);
          if (b.evidence) this.found();
          this.say(b.note, b.evidence ? 'good' : 'info');
        });
        chart.append(bar);
        labels.append(h('span', '', b.label));
      });
      if (e.limit) {
        const lim = h('div', 'lim', e.limit.label);
        lim.style.bottom = `${(e.limit.value / max) * 100}%`;
        chart.append(lim);
      }
      wrap.append(chart, labels);
    } else if (e.kind === 'inspect') {
      const grid = h('div', 'cards');
      e.items.forEach((it, i) => {
        const key = `${e.id}:${i}`;
        const card = h('button', `card ${this.seen.has(key) ? 'seen' : ''}`);
        card.append(h('b', '', it.title), h('span', '', it.summary));
        card.addEventListener('click', () => {
          this.seen.add(key);
          card.classList.add('seen');
          if (it.evidence) this.found();
          this.say(it.detail, it.evidence ? 'good' : 'info');
        });
        grid.append(card);
      });
      wrap.append(grid);
    } else if (e.kind === 'search') {
      const form = h('form', 'inline');
      const input = h('input', 'text wide') as HTMLInputElement;
      input.placeholder = e.placeholder;
      input.value = this.searchQuery;
      const go = h('button', 'btn', 'SEARCH');
      form.append(input, go);
      const list = h('div', 'results scrolly');
      const render = () => {
        list.replaceChildren();
        const q = this.searchQuery.trim().toLowerCase();
        const hits = q ? e.lines.filter((l) => l.toLowerCase().includes(q)) : e.lines.slice(0, 8);
        list.append(h('div', 'muted', q ? `${hits.length} of ${e.lines.length} lines match "${this.searchQuery}"` : `${e.lines.length} lines. Showing the first 8. Search to filter.`));
        for (const l of hits.slice(0, 40)) list.append(h('div', e.evidence.test(l) ? 'hitline' : '', l));
        if (q && hits.some((l) => e.evidence.test(l))) {
          this.found();
          this.say('That looks like the line that matters. Read it closely.', 'good');
        }
      };
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        this.searchQuery = input.value;
        render();
      });
      render();
      wrap.append(form, list);
    }
    return wrap;
  }

  // ---------------------------------------------------------------- config levels
  private configTab(spec: ConfigLevel): Node {
    const wrap = h('div', 'config');
    const left = h('div', 'mcol');
    left.append(h('div', 'mtitle', spec.configTitle));
    for (const f of spec.fields) left.append(this.fieldRow(f));
    const right = h('div', 'mcol');
    const apply = h('button', 'btn primary', this.busy ? 'CHECKING…' : `▶ ${spec.applyLabel}`);
    apply.disabled = this.busy;
    apply.addEventListener('click', () => this.applyConfig(spec));
    right.append(apply);
    const vl = h('div', 'vlog');
    if (!this.results.length) vl.append(h('div', 'muted', 'Results of your change appear here.'));
    for (const r of this.results) vl.append(h('div', r.pass ? 'ok' : 'err', `${r.pass ? '✓' : '✗'} ${r.label}`));
    right.append(vl);
    const grid = h('div', 'mgrid');
    grid.append(left, right);
    wrap.append(grid);
    return wrap;
  }

  private fieldRow(f: Field): HTMLElement {
    const row = h('div', `mrow f-${f.kind}`);
    row.append(h('span', 'k', f.label));
    const d = this.draft;
    switch (f.kind) {
      case 'number': {
        const s = h('span', 'stepper');
        const step = f.step ?? 1;
        const input = h('input', 'num') as HTMLInputElement;
        input.inputMode = 'decimal';
        input.value = String(d[f.key]);
        const decimals = (String(step).split('.')[1] ?? '').length;
        const set = (n: number) => {
          // Snap to the step and round away float noise (0.1 steps gave 99.80000000000001).
          d[f.key] = Number(Math.max(f.min, Math.min(f.max, Math.round(n / step) * step)).toFixed(decimals));
          input.value = String(d[f.key]);
        };
        const minus = h('button', 'btn sm', '−');
        const plus = h('button', 'btn sm', '+');
        minus.addEventListener('click', () => set(Number(d[f.key]) - step));
        plus.addEventListener('click', () => set(Number(d[f.key]) + step));
        input.addEventListener('change', () => {
          const typed = input.value.trim() === '' ? NaN : Number(input.value);
          set(Number.isFinite(typed) ? typed : Number(d[f.key]));
        });
        s.append(minus, input, plus);
        row.append(s);
        if (f.unit) row.append(h('span', 'unit', f.unit));
        break;
      }
      case 'text': {
        const input = h('input', 'text') as HTMLInputElement;
        input.value = String(d[f.key] ?? '');
        if (f.placeholder) input.placeholder = f.placeholder;
        input.addEventListener('input', () => (d[f.key] = input.value));
        row.append(input);
        break;
      }
      case 'toggle': {
        const seg = h('span', 'seg');
        for (const [val, label] of [
          [true, f.on ?? 'ON'],
          [false, f.off ?? 'OFF'],
        ] as const) {
          const b = h('button', `btn sm ${d[f.key] === val ? 'on' : ''}`, label);
          b.addEventListener('click', () => {
            d[f.key] = val;
            seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          });
          seg.append(b);
        }
        row.append(seg);
        break;
      }
      case 'choice': {
        const box = h('span', 'choices');
        for (const [val, label] of f.options) {
          const b = h('button', `opt ${d[f.key] === val ? 'on' : ''}`, label);
          b.addEventListener('click', () => {
            d[f.key] = val;
            box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          });
          box.append(b);
        }
        row.append(box);
        break;
      }
      case 'set': {
        const box = h('span', 'choices');
        for (const [val, label] of f.options) {
          const cur = () => (Array.isArray(d[f.key]) ? (d[f.key] as string[]) : []);
          const b = h('button', `opt check ${cur().includes(val) ? 'on' : ''}`, label);
          b.addEventListener('click', () => {
            const list = cur();
            d[f.key] = list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
            b.classList.toggle('on');
          });
          box.append(b);
        }
        row.append(box);
        break;
      }
      case 'order': {
        const list = h('ol', 'order');
        const render = () => {
          list.replaceChildren();
          const items = d[f.key] as string[];
          items.forEach((id, i) => {
            const li = h('li', '');
            const up = h('button', 'btn sm', '▲');
            const down = h('button', 'btn sm', '▼');
            up.disabled = i === 0;
            down.disabled = i === items.length - 1;
            const move = (dir: number) => {
              const next = [...items];
              [next[i], next[i + dir]] = [next[i + dir], next[i]];
              d[f.key] = next;
              render();
            };
            up.addEventListener('click', () => move(-1));
            down.addEventListener('click', () => move(1));
            li.append(h('span', 'otext', f.labels[id] ?? id), up, down);
            list.append(li);
          });
        };
        render();
        row.append(list);
        break;
      }
    }
    return row;
  }

  private applyConfig(spec: ConfigLevel): void {
    if (this.busy) return;
    if (same(this.draft, this.cfg)) {
      this.say('Nothing changed yet. Adjust a setting first.', 'warn');
      return;
    }
    this.noteChange();
    this.complete('fix');
    this.changedSinceStart = true;
    this.cfg = clone(this.draft);
    const v = spec.verify(clone(this.cfg));
    this.busy = true;
    this.status = 'verifying';
    this.results = [];
    this.say('Change applied. Checking whether it really works…');
    this.refreshTab();
    v.cases.forEach((cs, i) =>
      this.later(() => {
        this.results.push(cs);
        if (this.activeTab === CHANGE_TAB) this.refreshTab();
      }, 500 + i * 450),
    );
    this.later(() => this.judge(v, spec), 700 + v.cases.length * 450);
    this.openTab(CHANGE_TAB);
  }

  private judge(v: Verdict, spec: ConfigLevel): void {
    this.busy = false;
    if (passed(v)) {
      this.status = 'fixed';
      if (v.wasteful) this.attempts.wasteful = true;
      this.say(v.wasteful ? `It works! But: ${v.wasteful}` : 'Everything checks out. Fixed and verified!', v.wasteful ? 'warn' : 'good');
      this.refreshTab();
      this.finish(this.recap(spec.recap, clone(this.cfg)));
      return;
    }
    this.status = 'broken';
    this.attempts.failedChanges++;
    this.game.ui.toast('NOT FIXED YET · TRUST −1', 'bad');
    this.say(v.hint ?? 'Not fixed yet. Look at which checks failed.', 'bad');
    this.refreshTab();
  }

  // ---------------------------------------------------------------- terminal levels
  private terminalTab(spec: TerminalLevel): Node {
    const wrap = h('div', 'term');
    const out = h('div', 'term-out');
    for (const l of this.termLines.slice(-200)) out.append(h('div', l.cls, l.text));
    const form = h('form', 'term-in');
    const prompt = h('span', 'prompt', `${spec.term.host}$`);
    const input = h('input', 'term-input') as HTMLInputElement;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && this.history.length) {
        this.histIdx = Math.min(this.history.length - 1, this.histIdx + 1);
        input.value = this.history[this.histIdx];
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        this.histIdx = Math.max(-1, this.histIdx - 1);
        input.value = this.histIdx >= 0 ? this.history[this.histIdx] : '';
        e.preventDefault();
      } else if (e.key === 'Escape') input.blur();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const line = input.value;
      input.value = '';
      this.history.unshift(line);
      this.histIdx = -1;
      this.exec(spec, line);
    });
    form.append(prompt, input);
    wrap.append(out, form);
    out.addEventListener('click', () => input.focus());
    setTimeout(() => {
      out.scrollTop = out.scrollHeight;
      input.focus();
    }, 0);
    return wrap;
  }

  private print(text: string, cls = ''): void {
    for (const line of text.split('\n')) this.termLines.push({ text: line, cls });
  }

  private exec(spec: TerminalLevel, line: string): void {
    const s = this.term!;
    this.print(`${spec.term.host}$ ${line}`, 'cmd');
    const o = run(spec.term, s, line);
    if (o.kind === 'clear') this.termLines = [];
    else if (o.kind === 'edit') {
      this.openEditor(spec, o.path);
      return;
    } else {
      const r = o.result;
      if (r.out) this.print(r.out, r.bad ? 'err' : '');
      if (r.evidence) this.found();
      if (r.bad) {
        this.attempts.failedChanges++;
        this.game.ui.toast('THAT MADE THINGS WORSE · TRUST −1', 'bad');
      }
      if (r.changed) this.markChanged();
      if (r.verify) this.verifyTerm(spec);
    }
    this.refreshTab();
  }

  private markChanged(): void {
    this.noteChange();
    this.complete('fix');
    this.changedSinceStart = true;
  }

  private verifyTerm(spec: TerminalLevel): void {
    const v = spec.check(this.term!);
    if (passed(v) && this.changedSinceStart) {
      this.print(v.cases.map((cs) => `✓ ${cs.label}`).join('\n'), 'ok');
      this.status = 'fixed';
      if (v.wasteful) this.attempts.wasteful = true;
      this.say(v.wasteful ? `It works! But: ${v.wasteful}` : 'Verified: it works now!', v.wasteful ? 'warn' : 'good');
      this.finish(this.recap(spec.recap, this.term!));
    } else if (!passed(v)) {
      const failed = v.cases.filter((cs) => !cs.pass);
      this.print(failed.map((cs) => `✗ ${cs.label}`).join('\n'), 'err');
      if (v.hint && this.changedSinceStart) this.say(v.hint, 'warn');
    }
  }

  private openEditor(spec: TerminalLevel, path: string): void {
    const s = this.term!;
    const wrap = h('div', 'modal');
    const box = h('div', 'panel editor');
    const ta = h('textarea', 'code-edit') as HTMLTextAreaElement;
    ta.value = s.files[path];
    ta.spellcheck = false;
    const save = h('button', 'btn primary', '💾 SAVE');
    const cancel = h('button', 'btn', 'CANCEL');
    let closeOverlay = (): void => {};
    const close = () => {
      closeOverlay();
      this.refreshTab();
    };
    save.addEventListener('click', () => {
      const changed = saveFile(s, path, ta.value);
      this.print(changed ? `saved ${path}` : `${path}: no changes`, 'sys');
      if (changed) this.markChanged();
      close();
    });
    cancel.addEventListener('click', () => {
      this.print(`closed ${path} without saving`, 'sys');
      close();
    });
    ta.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save.click();
      }
      if (e.key === 'Escape') cancel.click();
    });
    const bar = h('div', 'editor-bar');
    bar.append(h('span', '', `✎ ${path}   (Ctrl/⌘+S to save, Esc to cancel)`), cancel, save);
    box.append(bar, ta);
    wrap.append(box);
    closeOverlay = this.openOverlay(wrap);
    void spec;
    setTimeout(() => ta.focus(), 0);
  }

  /** Dev/testing only: skip the intro, mark evidence found and apply the intended fix through the real UI flow. */
  devSolve(): void {
    this.devSkipIntro();
    this.found();
    const spec = this.spec;
    if (spec.type === 'config') {
      this.draft = clone(spec.solution);
      this.applyConfig(spec);
    } else {
      spec.solve(this.term!);
      this.markChanged();
      this.verifyTerm(spec);
      this.refreshTab();
    }
  }

  /** Dev/testing only: open every tab once so each renders. */
  devVisitTabs(): string[] {
    const ids = this.tabs().map((t) => t.id);
    for (const id of ids) this.openTab(id);
    return ids;
  }

  // ---------------------------------------------------------------- shared
  private recap<S>(r: RecapSpec<S>, s: S): Recap {
    const side = (x: Side, ok: boolean) => {
      const d = h('div', 'sidebox');
      d.append(h('pre', 'mini', x.lines.join('\n')), h('div', `outcome ${ok ? 'ok' : 'bad'}`, x.outcome));
      return d;
    };
    const after = r.after(s);
    return {
      headline: r.headline,
      before: { label: 'BEFORE', visual: side(r.before, false), caption: '' },
      after: { label: 'AFTER', visual: side(after, true), caption: '' },
      why: r.why,
      realWorld: typeof r.real === 'function' ? r.real(s) : r.real,
      realWorldCaption: r.realCaption,
    };
  }

  update(dt: number, t: number): void {
    this.baseUpdate(t);
    void dt;
    this.setAlert(this.status === 'fixed' ? undefined : this.spec.alert);
  }

  render(c: Ctx, t: number): void {
    this.backdrop.render(c, t, this.status, this.status === 'fixed' ? this.spec.board.fixed : this.spec.board.broken);
  }
}

function clone(c: Cfg): Cfg {
  const out: Cfg = {};
  for (const [k, v] of Object.entries(c)) out[k] = Array.isArray(v) ? [...v] : v;
  return out;
}

function same(a: Cfg, b: Cfg): boolean {
  const norm = (v: Value) => (Array.isArray(v) ? JSON.stringify(v) : String(v));
  return Object.keys({ ...a, ...b }).every((k) => norm(a[k]) === norm(b[k]));
}

function fmt(v: number, unit?: string): string {
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return unit ? `${n}${unit}` : n;
}
