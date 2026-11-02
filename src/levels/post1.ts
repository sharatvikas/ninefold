import { CharacterSheet, LOOKS, type Look } from '../art/characters';
import { blit, disc, Layer, makeCanvas, rect, rng, type Ctx } from '../art/pixels';
import { house, tree } from '../art/scenery';
import type { Game } from '../engine/game';
import { h } from '../ui/ui';
import { getLevel } from './catalog';
import { IncidentScene, type Exit, type Intro, type Tab } from './incident';
import { HOUSES, NAMES, RESIDENTS, START_WALL, deliver, lookup, normalizeName, parseHouse, wrongEntries, type Wall } from './sims/post';

const W = 384;
const HW = 66;
const HY = 38;
const HH = 72;
const STREET_Y = 112;
const POST_X = 18;
const HOUSE_X: Record<string, number> = { '3': 66, '7': 146, '9': 226, '12': 306 };
const STYLE: Record<string, { label: string; roof: string; wall: string; look: Look }> = {
  library: { label: 'LIBRARY', roof: '#3f8f4f', wall: '#efe6d2', look: LOOKS.ada },
  butcher: { label: 'BUTCHER', roof: '#b5523b', wall: '#f4e4d4', look: LOOKS.gus },
  school: { label: 'SCHOOL', roof: '#d0a030', wall: '#f0ead8', look: LOOKS.lin },
  bakery: { label: 'BAKERY', roof: '#e07a9a', wall: '#fbeede', look: LOOKS.rosa },
};

// ------------------------------------------------------------------ stage
type Trip = { name: string; house: string | undefined; onArrive: (receivedBy: string | undefined) => void };

class PostStage {
  revealed = new Set<string>();
  private carrier = new CharacterSheet({ ...LOOKS.player, hat: '#3b6fb5', hatHi: '#6a98e0', shirt: '#3b6fb5', accent: '#f8d030' });
  private residents = Object.fromEntries(Object.entries(STYLE).map(([k, s]) => [k, new CharacterSheet(s.look)]));
  private x = POST_X;
  private phase: 'idle' | 'out' | 'react' | 'back' | 'shrug' = 'idle';
  private timer = 0;
  private trip: Trip | undefined;
  private popups: { house: string; text: string; ttl: number; happy: boolean }[] = [];
  private hearts: { x: number; y: number; a: number }[] = [];
  private ground = new Layer(buildGround);

  get busy(): boolean {
    return this.phase !== 'idle';
  }

  readonly slotRects = Object.fromEntries(HOUSES.map((s) => [s, { x: (HOUSE_X[s] - 4) / W, y: (HY - 4) / 216, w: (HW + 8) / W, h: (HH + 10) / 216 }]));

  knock(houseNo: string, text?: string, happy = false): void {
    this.revealed.add(houseNo);
    const who = RESIDENTS[houseNo];
    this.popups = this.popups.filter((p) => p.house !== houseNo);
    this.popups.push({ house: houseNo, text: text ?? `The ${who}!`, ttl: 2.6, happy });
  }

  send(trip: Trip): void {
    this.trip = trip;
    if (!trip.house) {
      this.phase = 'shrug';
      this.timer = 1.6;
    } else this.phase = 'out';
  }

  private doorX(houseNo: string): number {
    return HOUSE_X[houseNo] + HW / 2 - 8;
  }

  update(dt: number): void {
    const speed = 80;
    const trip = this.trip;
    if (this.phase === 'out' && trip?.house) {
      const tx = this.doorX(trip.house);
      this.x = Math.min(tx, this.x + speed * dt);
      if (this.x >= tx) {
        this.phase = 'react';
        this.timer = 2;
        const who = RESIDENTS[trip.house];
        const happy = who === trip.name;
        this.knock(trip.house, happy ? 'For me? Thank you!' : `Not mine! I'm the ${who}.`, happy);
        if (happy) for (let i = 0; i < 5; i++) this.hearts.push({ x: tx + 2 + i * 4, y: STREET_Y - 30, a: 1 + i * 0.15 });
        trip.onArrive(who);
      }
    } else if (this.phase === 'react' || this.phase === 'shrug') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.phase === 'shrug') trip?.onArrive(undefined);
        this.phase = this.phase === 'shrug' ? 'idle' : 'back';
      }
    } else if (this.phase === 'back') {
      this.x = Math.max(POST_X, this.x - speed * 1.5 * dt);
      if (this.x <= POST_X) {
        this.phase = 'idle';
        this.trip = undefined;
      }
    }
    for (const p of this.popups) p.ttl -= dt;
    this.popups = this.popups.filter((p) => p.ttl > 0);
    for (const ht of this.hearts) {
      ht.y -= 14 * dt;
      ht.a -= 0.6 * dt;
    }
    this.hearts = this.hearts.filter((ht) => ht.a > 0);
  }

  render(c: Ctx, t: number): void {
    blit(c, this.ground.get(), 0, 0, W, 216);
    for (let i = 0; i < 3; i++) {
      const x = ((i * 140 + t * 5) % (W + 60)) - 30;
      disc(c, x, 10 + i * 4, 5, '#fff');
      disc(c, x + 7, 8 + i * 4, 7, '#fff');
      disc(c, x + 15, 11 + i * 4, 4, '#fff');
    }
    // signs: hidden until someone answers the door
    for (const no of HOUSES) {
      const x = HOUSE_X[no];
      const known = this.revealed.has(no);
      const label = known ? STYLE[RESIDENTS[no]].label : '? ? ?';
      c.font = '5px "Press Start 2P"';
      const tw = Math.ceil(c.measureText(label).width) + 6;
      const sx = Math.round(x + HW / 2 - tw / 2);
      const sy = HY + 37;
      rect(c, sx, sy, tw, 9, '#3a2a1a');
      rect(c, sx + 1, sy + 1, tw - 2, 7, known ? '#e8d2a0' : '#bfb4a0');
      c.fillStyle = '#3a2a1a';
      c.fillText(label, sx + 3, sy + 7);
    }
    // residents at their doors
    for (const p of this.popups) {
      const x = HOUSE_X[p.house] + HW / 2 - 8;
      this.residents[RESIDENTS[p.house]].draw(c, 'down', 0, x, HY + HH - 16);
      speech(c, x + 8, HY + 26, p.text, p.happy);
    }
    // carrier
    const walking = this.phase === 'out' || this.phase === 'back';
    const frame = walking ? 1 + (Math.floor(t * 8) % 2) : 0;
    const dir = this.phase === 'back' ? 'left' : this.phase === 'react' ? 'up' : this.phase === 'idle' ? 'down' : 'right';
    const cy = STREET_Y - 2;
    this.carrier.draw(c, dir, frame, this.x, cy - (frame ? 1 : 0));
    if (this.phase === 'out' || this.phase === 'react' || this.phase === 'shrug') {
      rect(c, this.x + 10, cy + 6, 8, 6, '#2a1e1a');
      rect(c, this.x + 11, cy + 7, 6, 4, '#fff8e8');
      rect(c, this.x + 13, cy + 8, 2, 1, '#c0392b');
      if (this.trip && this.phase !== 'react') {
        c.font = '4px "Press Start 2P"';
        c.fillStyle = '#2a1e1a';
        c.fillText(`TO: ${this.trip.name.toUpperCase()}`, this.x - 4, cy - 4);
      }
    }
    if (this.phase === 'shrug') speech(c, this.x + 8, cy - 14, 'No such name on the wall!', false);
    for (const ht of this.hearts) heart(c, ht.x, ht.y, Math.min(1, ht.a));
  }
}

function speech(c: Ctx, cx: number, y: number, text: string, happy: boolean): void {
  c.font = '5px "Press Start 2P"';
  const w = Math.ceil(c.measureText(text).width) + 8;
  const x = Math.round(Math.max(2, Math.min(W - w - 2, cx - w / 2)));
  rect(c, x - 1, y - 1, w + 2, 13, '#2a1e1a');
  rect(c, x, y, w, 11, happy ? '#e8fbe8' : '#fff');
  rect(c, Math.round(cx) - 1, y + 11, 3, 3, '#2a1e1a');
  c.fillStyle = happy ? '#1e8a4a' : '#7a2a1a';
  c.fillText(text, x + 4, y + 8);
}

function heart(c: Ctx, x: number, y: number, a: number): void {
  c.globalAlpha = a;
  rect(c, x, y, 2, 2, '#e0407a');
  rect(c, x + 3, y, 2, 2, '#e0407a');
  rect(c, x, y + 1, 5, 2, '#e0407a');
  rect(c, x + 1, y + 3, 3, 1, '#e0407a');
  rect(c, x + 2, y + 4, 1, 1, '#e0407a');
  c.globalAlpha = 1;
}

function buildGround(): HTMLCanvasElement {
  const [cv, c] = makeCanvas(W, 216);
  const R = rng(3);
  ['#bfe6ff', '#c9ebff', '#d4efff', '#def3ff'].forEach((col, i) => rect(c, 0, i * 7, W, 7, col));
  rect(c, 0, 28, W, 90, '#5fae4a');
  for (let i = 0; i < 700; i++) rect(c, (R() * W) | 0, 28 + ((R() * 90) | 0), 1, 1, R() < 0.5 ? '#55a042' : '#6dbd55');
  rect(c, 0, STREET_Y + 6, W, 216 - STREET_Y, '#d9b77a');
  for (let i = 0; i < 1100; i++) rect(c, (R() * W) | 0, STREET_Y + 6 + ((R() * (210 - STREET_Y)) | 0), 1, 1, R() < 0.5 ? '#c9a466' : '#e6c890');
  rect(c, 0, STREET_Y + 6, W, 1, '#b8955c');
  tree(c, 40, 76);
  tree(c, 128, 84);
  tree(c, 288, 88);
  house(c, -18, 50, 62, 66, { roof: '#3b6fb5', wall: '#f0d6a8', label: 'POST' });
  for (const no of HOUSES) {
    const s = STYLE[RESIDENTS[no]];
    const x = HOUSE_X[no];
    house(c, x, HY, HW, HH, { roof: s.roof, wall: s.wall, label: '' });
    const px = x + HW / 2 - 7;
    const py = HY + 48;
    rect(c, px, py, 14, 8, '#2a1e1a');
    rect(c, px + 1, py + 1, 12, 6, '#f8f0d8');
    c.font = '5px "Press Start 2P"';
    c.fillStyle = '#2a1e1a';
    c.fillText(no.padStart(2, ' '), px + 2, py + 7);
    rect(c, x + HW / 2 - 6, HY + HH, 12, 6, '#c9a466');
  }
  return cv;
}

// ------------------------------------------------------------------ scene
export class PostScene extends IncidentScene {
  private stage = new PostStage();
  private wall: Wall = { ...START_WALL };
  private draft: Wall = { ...START_WALL };
  private lookups: string[] = [];
  private lookedUpBakery = false;
  private autoSent = false;
  private letterName = 'bakery';
  private letterLog: string[] = [];
  private lookupText = '';

  constructor(game: Game, exit: Exit) {
    super(game, getLevel('post-1'), exit);
  }

  protected intro(): Intro {
    return {
      symptom: 'Customers who ask for "the bakery" keep getting sent to the wrong shop. Letters addressed to the bakery never arrive.',
      known: [
        'Nobody remembers house numbers. People give the Post Office a NAME.',
        'The sorting wall turns each name into a house NUMBER, and the carrier walks there.',
        'The houses have numbers, but their shop signs fell off in the storm.',
      ],
      goal: 'Find where the bakery\'s letters go wrong, fix the sorting wall, and send a test letter to prove it.',
    };
  }

  protected tabs(): Tab[] {
    return [
      { id: 'lookup', icon: '🔎', label: 'LOOKUP' },
      { id: 'wall', icon: '🗂', label: 'SORTING WALL' },
      { id: 'letter', icon: '✉', label: 'TEST LETTER' },
    ];
  }

  enter(): void {
    super.enter();
    const zones = h('div', 'zones');
    for (const no of HOUSES) {
      const r = this.stage.slotRects[no];
      const z = h('div', 'zone');
      z.title = `Knock on No. ${no}`;
      Object.assign(z.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
      z.addEventListener('click', () => this.knock(no));
      zones.append(z);
    }
    this.root.insertBefore(zones, this.root.firstChild);
  }

  private knock(no: string): void {
    if (this.root.querySelector('.modal')) return;
    const first = !this.stage.revealed.has(no);
    this.stage.knock(no);
    const who = RESIDENTS[no];
    if (first) this.say(`You knocked on No. ${no}. The ${who} lives there.`, who === 'bakery' ? 'good' : 'info');
    this.checkCause();
  }

  protected renderTab(id: string): Node {
    if (id === 'lookup') return this.lookupTab();
    if (id === 'wall') return this.wallTab();
    return this.letterTab();
  }

  private lookupTab(): Node {
    const wrap = h('div', '');
    wrap.append(h('div', 'hint', 'Ask the wall where a name goes, the same way the carrier does. Try a shop name.'));
    const form = h('form', 'inline');
    const input = h('input', 'text') as HTMLInputElement;
    input.placeholder = 'e.g. library';
    input.value = this.lookupText;
    input.addEventListener('input', () => (this.lookupText = input.value));
    const go = h('button', 'btn', 'LOOK UP');
    form.append(input, go);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = normalizeName(input.value);
      if (!name) return;
      const house = lookup(this.wall, name);
      this.lookups.unshift(house ? `${name} → No. ${house}` : `${name} → not on the wall`);
      if (name === 'bakery') this.lookedUpBakery = true;
      this.lookupText = '';
      this.refreshTab();
      this.checkCause();
      if (name === 'bakery' && house && RESIDENTS[house] !== 'bakery' && this.stage.revealed.has(house))
        this.say(`The wall sends "bakery" to No. ${house}… but No. ${house} is the ${RESIDENTS[house]}!`, 'good');
      else if (!house) this.say(`"${name}" isn't on the wall at all, so letters to it come straight back.`);
    });
    const list = h('div', 'results');
    for (const l of this.lookups.slice(0, 5)) list.append(h('div', 'mono', l));
    wrap.append(form, list);
    setTimeout(() => input.focus(), 0);
    return wrap;
  }

  private wallTab(): Node {
    const wrap = h('div', '');
    wrap.append(h('div', 'hint', 'Each name points to a house number. Type a new number to change where that name\'s letters go, then save.'));
    const grid = h('div', 'wallgrid');
    for (const name of NAMES) {
      const input = h('input', 'num') as HTMLInputElement;
      input.value = this.draft[name];
      input.inputMode = 'numeric';
      input.addEventListener('input', () => (this.draft[name] = input.value));
      const changed = this.draft[name] !== this.wall[name];
      const row = h('div', `wrow ${changed ? 'changed' : ''}`);
      row.append(h('span', 'name', name), h('span', 'arrow', '→ No.'), input);
      grid.append(row);
    }
    const save = h('button', 'btn primary', '💾 SAVE WALL');
    save.addEventListener('click', () => this.saveWall());
    wrap.append(grid, save);
    return wrap;
  }

  private letterTab(): Node {
    const wrap = h('div', '');
    wrap.append(h('div', 'hint', 'Send a test letter and watch where the carrier takes it.'));
    const form = h('form', 'inline');
    const input = h('input', 'text') as HTMLInputElement;
    input.value = this.letterName;
    input.addEventListener('input', () => (this.letterName = input.value));
    const go = h('button', 'btn primary', this.stage.busy ? 'CARRIER IS OUT…' : '✉ SEND');
    go.disabled = this.stage.busy;
    form.append(h('span', 'k', 'TO:'), input, go);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendLetter(input.value);
    });
    const list = h('div', 'results');
    for (const l of this.letterLog.slice(0, 4)) list.append(h('div', l.includes('✓') ? 'ok' : 'err', l));
    wrap.append(form, list);
    return wrap;
  }

  private saveWall(): void {
    const cleaned: Wall = {};
    for (const n of NAMES) {
      const v = parseHouse(this.draft[n] ?? '');
      if (!v) {
        this.say(`"${this.draft[n]}" isn't a house number. Use a number like 3 or 12.`, 'warn');
        return;
      }
      cleaned[n] = v;
    }
    const changed = NAMES.filter((n) => cleaned[n] !== this.wall[n]);
    if (!changed.length) {
      this.say('Nothing changed on the wall.', 'warn');
      return;
    }
    this.noteChange();
    this.complete('fix');
    const brokeGood = changed.filter((n) => wrongEntries(this.wall).indexOf(n) === -1 && cleaned[n] !== this.wall[n]);
    this.wall = cleaned;
    this.draft = { ...cleaned };
    if (wrongEntries(this.wall).length) this.attempts.failedChanges++;
    this.refreshTab();
    this.say(
      brokeGood.length
        ? `Saved. Careful: you also changed ${brokeGood.join(', ')}, which was working before. Send test letters to check.`
        : 'Saved. A change isn\'t done until you\'ve checked it: send a test letter.',
      brokeGood.length ? 'warn' : 'info',
    );
  }

  private sendLetter(raw: string): void {
    if (this.stage.busy) return;
    const d = deliver(this.wall, raw);
    if (!d.name) return;
    this.stage.send({
      name: d.name,
      house: d.house,
      onArrive: (who) => {
        const line = !d.house ? `${d.name}: not on the wall, returned ✗` : `${d.name} → No. ${d.house} → ${who} ${d.correct ? '✓' : '✗'}`;
        this.letterLog.unshift(line);
        if (d.house) this.checkCause();
        if (this.activeTab === 'letter') this.refreshTab();
        if (d.correct && d.name === 'bakery' && !wrongEntries(this.wall).length) {
          this.say('The bakery got its letter. Fixed and verified!', 'good');
          this.finish(this.recap());
        } else if (d.correct) this.say(`The ${d.name} got its letter.`, 'good');
        else if (d.house) this.say(`Wrong house: the ${who} got a letter meant for the ${d.name}.`, 'bad');
      },
    });
    if (this.activeTab === 'letter') this.refreshTab();
  }

  private checkCause(): void {
    const bakeryHouse = lookup(this.wall, 'bakery');
    if (!this.steps.cause && this.lookedUpBakery && bakeryHouse && this.stage.revealed.has(bakeryHouse) && RESIDENTS[bakeryHouse] !== 'bakery') {
      this.complete('cause');
      this.game.ui.toast('CAUSE FOUND', 'good');
    }
  }

  private recap() {
    const flow = (name: string, house: string, ok: boolean) => {
      const d = h('div', 'flow');
      d.append(h('span', 'chip-s', `"${name}"`), h('span', 'arr', '→'), h('span', 'chip-s', `No. ${house}`), h('span', 'arr', '→'), h('span', `chip-s ${ok ? 'ok' : 'bad'}`, `${RESIDENTS[house]} ${ok ? '✓' : '✗'}`));
      return d;
    };
    return {
      headline: 'The bakery was fine. Its line on the sorting wall pointed to the wrong house.',
      before: { label: 'BEFORE', visual: flow('bakery', START_WALL.bakery, false), caption: 'The wall said bakery = No. 7, so every letter went to the butcher. Nothing was wrong with the bakery, the carrier or the roads.' },
      after: { label: 'AFTER', visual: flow('bakery', this.wall.bakery, true), caption: `You found the bakery at No. ${this.wall.bakery} by knocking, fixed that one line, and proved it with a test letter.` },
      why: 'Everyone in town finds places by name, so one wrong line on the wall sends everyone to the wrong door, even though every building works fine. You checked what the wall said (lookup), checked what was really there (knocking), changed one line, then verified.',
      realWorld: `$ dig +short bakery.town
10.0.3.7           # the butcher's server

# town.zone
- bakery   IN  A   10.0.3.7
+ bakery   IN  A   10.0.3.12

$ dig +short bakery.town
10.0.3.12          # ✓`,
      realWorldCaption: 'Sorting wall = DNS, name = domain, house number = IP address, one line = an A record, knocking = curl. In Act 2 you\'ll find fixes take time to spread (TTL).',
    };
  }

  update(dt: number, t: number): void {
    this.baseUpdate(t);
    this.stage.update(dt);
    if (this.steps.understand && !this.autoSent) {
      this.autoSent = true;
      this.sendLetter('bakery');
    }
    this.setAlert(this.steps.verify ? undefined : 'BAKERY LETTERS GOING ASTRAY');
  }

  render(c: Ctx, t: number): void {
    this.stage.render(c, t);
  }
}
