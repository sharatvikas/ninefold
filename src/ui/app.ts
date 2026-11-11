/** The whole game outside a ticket: title, the town map, the board of tickets, and the overlays. */
import { analytics } from '../analytics/analytics';
import { DISTRICTS, LEVELS, levelsIn, type DistrictId, type LevelMeta } from '../curriculum/catalog';
import { ALL_SPECS } from '../curriculum/content';
import {
  bigIncidentBlockers, closeTicket, districtTally, downtimePerMonth, hasSave, levelStatus, loadProgress, newProgress, nextLevelIn, ninesEarned,
  saveProgress, TOTAL_NINES, townNines, uptimeLabel, type Progress,
} from '../game/progress';
import type { Nines } from '../game/score';
import type { TownState } from '../town/town';
import { Desk } from './desk';
import { button, h, icon, nineLamps, prefersCalm, put } from './dom';
import { openRunbook, openSettings } from './overlays';
import { Sound } from './sound';
import { TownView } from './townview';

const ACT_NAMES = ['', 'Act 1 · Town logic', 'Act 2 · Real names', 'Act 3 · Real tools'];
export const actName = (l: LevelMeta): string => (l.district === 'big' ? `Big incident ${l.num}` : ACT_NAMES[l.act]);

export class App {
  progress: Progress;
  readonly sound = new Sound();
  private storage: Storage | undefined;
  private hub: HTMLElement;
  private board: HTMLElement;
  private map: TownView;
  private selected: DistrictId | undefined;
  private desk: Desk | undefined;
  private mode: 'title' | 'hub' = 'title';

  constructor(private root: HTMLElement) {
    try {
      this.storage = window.localStorage;
    } catch {
      this.storage = undefined;
    }
    const returning = hasSave(this.storage);
    this.progress = loadProgress(this.storage);
    this.sound.enabled = this.progress.settings.sound;
    analytics.track({ name: 'session_start', returning, solved: Object.keys(this.progress.solved).length });

    this.map = new TownView({ pins: true, onPick: (id) => this.select(id) });
    this.board = h('aside', { class: 'board', 'aria-label': 'Tickets' });
    const top = h('header', 'hub-top',
      h('div', 'wordmark', h('span', 'wm-name', 'Ninefold'), h('span', 'wm-sub', 'night shift')),
      h('div', 'hub-actions',
        button('icon-btn', [icon('book'), h('span', 'btn-label', 'Runbook')], () => openRunbook(this), { 'aria-label': 'Runbook' }),
        button('icon-btn', [icon('gear'), h('span', 'btn-label', 'Settings')], () => openSettings(this), { 'aria-label': 'Settings' }),
      ),
    );
    this.hub = h('main', 'hub', h('div', 'hub-map', h('div', 'map-scroll', h('div', 'map-inner', this.map.el))), top, this.board);
    root.append(this.hub);
    this.applySettings();
    this.showTitle(returning);
    this.refresh();
    this.map.start();
    // Centre the map on phones, where it is wider than the screen.
    requestAnimationFrame(() => {
      const sc = this.hub.querySelector('.map-scroll') as HTMLElement;
      sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
    });
  }

  get calm(): boolean {
    return this.progress.settings.calm || prefersCalm();
  }

  applySettings(): void {
    this.sound.enabled = this.progress.settings.sound;
    this.map.calm = this.calm;
    document.documentElement.classList.toggle('calm', this.calm);
  }

  save(): void {
    saveProgress(this.storage, this.progress);
  }

  /** Replace all progress (reset, or a pasted save code). */
  replaceProgress(p: Progress): void {
    this.progress = p;
    this.save();
    this.applySettings();
    this.selected = undefined;
    this.refresh();
  }

  /** Called the moment a ticket's fix is verified, before any animation or recap. */
  ticketSolved(id: string, nines: Nines): void {
    this.progress = closeTicket(this.progress, id, nines);
    this.save();
  }

  // ---------------------------------------------------------------- title

  private showTitle(returning: boolean): void {
    this.mode = 'title';
    this.hub.dataset.mode = 'title';
    const done = Object.keys(this.progress.solved).length;
    const title = h('section', 'title',
      h('div', 'title-inner',
        h('p', 'eyebrow', 'A game about keeping the lights on'),
        h('h1', 'title-word', 'Ninefold'),
        h('p', 'title-lede', 'The town runs like a production system. Ships are containers, letters are packets, and tonight you carry the pager.'),
        h('p', 'title-sub', 'Learn DevOps, SRE and cloud engineering by fixing 51 real kinds of outage: find the evidence, make one change, prove it worked.'),
        h('div', 'title-actions',
          button('btn primary big', returning && done ? 'Continue the shift' : 'Start the night shift', () => {
            this.sound.play('lamp');
            this.enterHub();
          }),
          returning && done ? h('span', 'title-progress', `${done} of ${LEVELS.length} tickets closed · town at ${uptimeLabel(townNines(this.progress))}`) : h('span', 'title-progress', 'Free, no account, about 3 minutes a ticket'),
        ),
      ),
    );
    this.hub.append(title);
  }

  private enterHub(): void {
    this.mode = 'hub';
    this.hub.dataset.mode = 'hub';
    const t = this.hub.querySelector('.title');
    t?.classList.add('leaving');
    setTimeout(() => t?.remove(), this.calm ? 0 : 500);
    // A new player is pointed at the gentlest first ticket.
    if (!Object.keys(this.progress.solved).length) this.select('harbor');
  }

  // ---------------------------------------------------------------- map + board

  private townState(): TownState {
    const districts = {} as TownState['districts'];
    for (const d of DISTRICTS) {
      const t = districtTally(this.progress, d.id);
      districts[d.id] = { lit: t.done / t.total, open: t.open && this.mode === 'hub' };
    }
    return { districts, selected: this.mode === 'hub' ? this.selected : undefined, nines: townNines(this.progress) };
  }

  refresh(): void {
    const counts = {} as Record<DistrictId, string>;
    for (const d of DISTRICTS) {
      const t = districtTally(this.progress, d.id);
      counts[d.id] = `${t.done}/${t.total}`;
    }
    this.map.setState(this.townState(), counts);
    this.renderBoard();
  }

  select(id: DistrictId | undefined): void {
    if (this.mode !== 'hub') return;
    if (id && id !== this.selected) this.sound.play('tap');
    this.selected = id;
    this.refresh();
    if (id) this.map.reveal(id);
    this.board.scrollTop = 0;
  }

  private renderBoard(): void {
    const p = this.progress;
    const n = townNines(p);
    const done = Object.keys(p.solved).length;
    const lamps = h('div', { class: 'nine-row', role: 'img', 'aria-label': `${Math.floor(n)} of 9 nines lit` });
    for (let i = 1; i <= 9; i++) lamps.append(h('i', i <= Math.floor(n + 1e-9) ? 'on' : i - n < 1 ? 'part' : ''));
    const uptime = h('section', 'uptime',
      h('div', 'uptime-head', h('span', 'k', 'Town uptime'), h('span', 'k dim', `${done}/${LEVELS.length} tickets · ${ninesEarned(p)}/${TOTAL_NINES} nines`)),
      h('div', 'uptime-num', uptimeLabel(n)),
      lamps,
      h('p', 'uptime-note', done === LEVELS.length && ninesEarned(p) === TOTAL_NINES
        ? 'Nine nines. Every lamp in Ninefold is lit.'
        : `At this level the town is dark about ${downtimePerMonth(n)} a month. Every clean fix adds to the nines.`),
    );
    put(this.board, uptime, this.selected ? this.districtPanel(this.selected) : this.pagerPanel());
  }

  private pagerPanel(): HTMLElement {
    const p = this.progress;
    const list = h('div', 'pager-list');
    for (const d of DISTRICTS) {
      const next = nextLevelIn(p, d.id);
      const t = districtTally(p, d.id);
      const status = !next ? 'done' : levelStatus(p, next);
      const row = button(`pager-row ${status}`, [
        h('span', 'pr-state', status === 'open' ? h('span', 'dot-open') : status === 'done' ? icon('check', 16) : icon('lock', 15)),
        h('span', 'pr-main',
          h('span', 'pr-name', d.name, h('span', 'pr-topic', d.topic)),
          h('span', 'pr-ticket', status === 'done' ? 'All quiet. Every ticket closed.' : status === 'locked' ? this.lockReason(next!) : `“${next!.ticket}”`),
        ),
        h('span', 'pr-count', `${t.done}/${t.total}`),
      ], () => this.select(d.id));
      list.append(row);
    }
    return h('section', 'panel', h('h2', 'panel-title', 'On the pager'), h('p', 'panel-sub', 'Pick a district on the map, or from the list.'), list);
  }

  private lockReason(l: LevelMeta): string {
    if (l.district !== 'big') return `Close ticket ${l.num - 1} first.`;
    const left = bigIncidentBlockers(this.progress, l.act).length;
    return `Rings when every Act ${l.act} ticket in town is closed (${left} to go).`;
  }

  private districtPanel(id: DistrictId): HTMLElement {
    const p = this.progress;
    const d = DISTRICTS.find((x) => x.id === id)!;
    const next = nextLevelIn(p, id);
    const rows = h('ol', 'ticket-list');
    for (const l of levelsIn(id)) {
      const status = levelStatus(p, l);
      const solved = p.solved[l.id];
      const main = h('span', 'tk-main',
        h('span', 'tk-title', l.title),
        h('span', 'tk-sub', status === 'done' ? l.concept : status === 'locked' ? this.lockReason(l) : actName(l)),
      );
      const right = status === 'done' ? nineLamps(solved.nines) : status === 'open' ? h('span', 'tk-go', 'Take', icon('arrow', 15)) : icon('lock', 15);
      const row = button(`ticket-row ${status}`, [h('span', 'tk-num', String(l.num)), main, h('span', 'tk-right', right)], () => this.openTicket(l.id), { disabled: status === 'locked' });
      rows.append(h('li', '', row));
    }
    const quote = next && levelStatus(p, next) === 'open' ? h('blockquote', 'keeper', h('p', '', `“${next.ticket}”`), h('cite', '', `${d.keeper}, ${d.name}`)) : null;
    return h('section', 'panel',
      button('link back-link', [icon('back', 15), 'All districts'], () => this.select(undefined)),
      h('h2', 'panel-title big', d.name),
      h('p', 'panel-sub', d.topic),
      quote,
      rows,
    );
  }

  // ---------------------------------------------------------------- tickets

  openTicket(id: string): void {
    const meta = LEVELS.find((l) => l.id === id);
    const spec = ALL_SPECS.find((s) => s.id === id);
    if (!meta || !spec || levelStatus(this.progress, meta) === 'locked' || this.desk) return;
    this.map.stop();
    this.hub.hidden = true;
    this.desk = new Desk(this, meta, spec, () => this.closeTicketView());
    this.root.append(this.desk.el);
    this.desk.el.focus();
  }

  closeTicketView(then?: string): void {
    this.desk?.destroy();
    this.desk = undefined;
    this.hub.hidden = false;
    this.refresh();
    this.map.start();
    if (then) this.openTicket(then);
  }

  /** For the reset button. */
  blank(): Progress {
    return { ...newProgress(), settings: { ...this.progress.settings } };
  }
}
