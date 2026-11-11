/** The town canvas plus its tappable labels. Used as the map, and (with a focus) as the scene on a ticket. */
import { DISTRICTS, type DistrictId } from '../curriculum/catalog';
import { Town, type Focus, type TownState } from '../town/town';
import { h } from './dom';

export class TownView {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private pins = new Map<DistrictId, HTMLButtonElement>();
  private town = new Town();
  private state: TownState | undefined;
  private raf = 0;
  private last = 0;
  private t0 = performance.now();
  private size = { w: 0, h: 0 };
  private ro: ResizeObserver;
  calm = false;
  focus: Focus | undefined;

  constructor(opts: { pins: boolean; onPick?: (id: DistrictId) => void }) {
    this.canvas = h('canvas', { class: 'town-canvas', 'aria-hidden': 'true' });
    this.el = h('div', 'town-view', this.canvas);
    if (opts.pins) {
      for (const d of DISTRICTS) {
        const b = h('button', { class: 'pin', type: 'button' }, h('span', 'pin-dot'), h('span', 'pin-name', d.name), h('span', 'pin-count'));
        b.addEventListener('click', () => opts.onPick?.(d.id));
        this.pins.set(d.id, b);
        this.el.append(b);
      }
      this.canvas.addEventListener('click', (e) => {
        const r = this.canvas.getBoundingClientRect();
        const id = this.town.districtAt(e.clientX - r.left, e.clientY - r.top);
        if (id) opts.onPick?.(id);
      });
    }
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.el);
  }

  setState(st: TownState, counts?: Record<DistrictId, string>): void {
    this.state = st;
    for (const [id, b] of this.pins) {
      const d = st.districts[id];
      b.classList.toggle('open', d.open);
      b.classList.toggle('done', d.lit >= 1);
      b.classList.toggle('sel', st.selected === id);
      b.setAttribute('aria-pressed', String(st.selected === id));
      (b.querySelector('.pin-count') as HTMLElement).textContent = counts?.[id] ?? '';
    }
    this.frame(true);
  }

  /** Scroll a district's label into view (the map pans sideways on phones). */
  reveal(id: DistrictId): void {
    this.pins.get(id)?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: this.calm ? 'auto' : 'smooth' });
  }

  start(): void {
    if (this.raf) return;
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      if (now - this.last < (this.calm ? 400 : 33)) return;
      this.last = now;
      this.frame(false);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.stop();
    this.ro.disconnect();
  }

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    const w = Math.round(r.width);
    const hgt = Math.round(r.height);
    if (!w || !hgt || (w === this.size.w && hgt === this.size.h)) return;
    this.size = { w, h: hgt };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hgt * dpr);
    this.canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.town.layout(w, hgt, this.focus);
    for (const [id, b] of this.pins) {
      const [x, y] = this.town.anchor(id).label;
      b.style.left = `${x}px`;
      // Keep labels of tall towers on screen.
      b.style.top = `${Math.max(y, 36)}px`;
    }
    this.frame(true);
  }

  private frame(force: boolean): void {
    if (!this.state || !this.size.w) return;
    if (!force && !this.raf) return;
    const c = this.canvas.getContext('2d')!;
    this.town.draw(c, this.state, { t: (performance.now() - this.t0) / 1000, calm: this.calm, focus: this.focus });
  }
}
