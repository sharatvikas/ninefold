/** The Journal: a scrapbook of what you've done around town that isn't a ticket. */
import type { Progress } from '../state/progress';
import { CURIOS } from '../world/curios';
import { BUGS, FISH, MEDAL_ICON, formatTime, medalFor } from '../world/pastimes';
import { h } from './ui';

export class Journal {
  readonly el = h('div', 'modal hidden');
  open = false;
  /** Ignore the key press that opened it, so it doesn't close in the same frame. */
  fresh = false;

  constructor(private onClose: () => void) {
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target === this.el) this.close();
    });
  }

  show(p: Progress): void {
    this.el.replaceChildren();
    const box = h('div', 'panel journal');
    const head = h('div', 'ql-head');
    const close = h('button', 'btn', '✕');
    close.setAttribute('aria-label', 'Close the journal');
    close.addEventListener('click', () => this.close());
    head.append(h('div', 'title', 'JOURNAL'), close);

    const fish = p.fish ?? {};
    const bugs = p.bugs ?? {};
    const nFish = FISH.filter((f) => fish[f.id]).length;
    const nBugs = BUGS.filter((b) => bugs[b.id]).length;

    const fishSec = h('div', 'jn-sec');
    fishSec.append(h('div', 'jn-title', `🎣 FISH ${nFish}/${FISH.length}`), h('div', 'jn-hint', 'Cast from the meadow jetty or the harbor dock. Some only bite at night.'));
    const fishGrid = h('div', 'jn-grid');
    for (const f of FISH) {
      const n = fish[f.id] ?? 0;
      const card = h('div', `jn-card ${n ? '' : 'unknown'}`);
      const dot = h('span', 'jn-fish');
      dot.style.setProperty('--c', n ? f.col : '#b8a890');
      dot.style.setProperty('--f', n ? f.fin : '#a89880');
      card.append(dot, h('span', 'jn-name', n ? f.name : '???'), h('span', 'jn-meta', n ? `×${n}` : f.where === 'pond' ? 'pond' : 'sea'));
      card.title = n ? f.note : f.night ? 'Bites after dark.' : 'Not caught yet.';
      fishGrid.append(card);
    }
    fishSec.append(fishGrid);

    const bugSec = h('div', 'jn-sec');
    bugSec.append(h('div', 'jn-title', `🦋 BUGS ${nBugs}/${BUGS.length}`), h('div', 'jn-hint', 'In the long grass of Lantern Meadow. Each one moves its own way.'));
    const bugGrid = h('div', 'jn-grid bugs');
    for (const b of BUGS) {
      const n = bugs[b.id] ?? 0;
      const card = h('div', `jn-card wide ${n ? '' : 'unknown'}`);
      card.append(h('span', 'jn-name', n ? b.name : '???'), h('span', 'jn-tip', n ? b.note : b.tip), h('span', 'jn-meta', n ? `×${n}` : ''));
      bugGrid.append(card);
    }
    bugSec.append(bugGrid);

    const side = h('div', 'jn-side');
    const run = h('div', 'jn-sec');
    const best = p.runBest;
    run.append(
      h('div', 'jn-title', '✉ LETTER RUN'),
      h('div', 'jn-big', best ? `${MEDAL_ICON[medalFor(best)]} ${formatTime(best)}` : '—'),
      h('div', 'jn-hint', best ? 'Your best time. Gold is under 0:38.' : 'Press E at the red postbox by the Post office.'),
    );
    const curios = p.found?.length ?? 0;
    const cur = h('div', 'jn-sec');
    cur.append(
      h('div', 'jn-title', `✦ CURIOS ${curios}/${CURIOS.length}`),
      h('div', 'jn-hint', curios < CURIOS.length ? 'Little sparkles hidden around town.' : 'All found!'),
    );
    side.append(run, cur);

    const body = h('div', 'jn-body');
    const main = h('div', 'jn-main');
    main.append(fishSec, bugSec);
    body.append(main, side);
    box.append(head, body);
    this.el.append(box);
    this.el.classList.remove('hidden');
    this.open = true;
    this.fresh = true;
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    this.onClose();
  }
}
