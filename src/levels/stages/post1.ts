import { CharacterSheet, LOOKS } from '../../art/characters';
import { disc, rect, rng, type Ctx } from '../../art/pixels';
import { house, tree } from '../../art/scenery';
import { getLevel } from '../catalog';
import type { SortLevel, SortStage } from '../types';

const W = 384;
const HOUSES = [
  { slot: '3', owner: 'library', label: 'LIBRARY', roof: '#3f8f4f', wall: '#efe6d2', x: 66 },
  { slot: '7', owner: 'butcher', label: 'BUTCHER', roof: '#b5523b', wall: '#f4e4d4', x: 146 },
  { slot: '9', owner: 'school', label: 'SCHOOL', roof: '#d0a030', wall: '#f0ead8', x: 226 },
  { slot: '12', owner: 'bakery', label: 'BAKERY', roof: '#e07a9a', wall: '#fbeede', x: 306 },
] as const;
const HW = 66;
const HY = 58;
const HH = 72;
const STREET_Y = 132;
const POST_X = 18;

type State = { assign: Record<string, string>; solved: boolean };

class PostStage implements SortStage {
  private carrier = new CharacterSheet({ ...LOOKS.player, hat: '#3b6fb5', hatHi: '#6a98e0', shirt: '#3b6fb5', accent: '#f8d030' });
  private ground: HTMLCanvasElement | undefined;
  private x = POST_X;
  private phase: 'out' | 'react' | 'back' = 'out';
  private timer = 0;
  private target = '7';
  private happy = false;
  private hearts: { x: number; y: number; a: number }[] = [];

  readonly slotRects = Object.fromEntries(
    HOUSES.map((h) => [h.slot, { x: (h.x - 4) / W, y: (HY - 4) / 216, w: (HW + 8) / W, h: (HH + 18) / 216 }]),
  );

  private doorX(slot: string): number {
    const h = HOUSES.find((h) => h.slot === slot)!;
    return h.x + HW / 2 - 8;
  }

  update(dt: number, _t: number, s: State): void {
    const speed = 70;
    if (this.phase === 'out') {
      const tx = this.doorX(this.target);
      this.x = Math.min(tx, this.x + speed * dt);
      if (this.x >= tx) {
        this.phase = 'react';
        this.timer = 1.6;
        const h = HOUSES.find((h) => h.slot === this.target)!;
        this.happy = h.owner === 'bakery';
        if (this.happy) for (let i = 0; i < 4; i++) this.hearts.push({ x: tx + 4 + i * 4, y: STREET_Y - 30, a: 1 + i * 0.2 });
      }
    } else if (this.phase === 'react') {
      this.timer -= dt;
      if (this.timer <= 0) this.phase = 'back';
    } else {
      this.x = Math.max(POST_X, this.x - speed * 1.4 * dt);
      if (this.x <= POST_X) {
        this.phase = 'out';
        this.target = s.assign['bakery'] ?? '7';
      }
    }
    for (const h of this.hearts) {
      h.y -= 14 * dt;
      h.a -= 0.6 * dt;
    }
    this.hearts = this.hearts.filter((h) => h.a > 0);
  }

  render(c: Ctx, t: number, s: State): void {
    if (!this.ground) this.ground = buildGround();
    c.drawImage(this.ground, 0, 0);
    // clouds
    for (let i = 0; i < 3; i++) {
      const x = ((i * 140 + t * 5) % (W + 60)) - 30;
      disc(c, x, 18 + i * 6, 7, '#ffffff');
      disc(c, x + 9, 16 + i * 6, 9, '#ffffff');
      disc(c, x + 19, 19 + i * 6, 6, '#ffffff');
    }
    // highlight the house the bakery's sign currently points at
    const pointed = s.assign['bakery'];
    const ph = HOUSES.find((h) => h.slot === pointed);
    if (ph) {
      const pulse = Math.floor(t * 3) % 2;
      rect(c, ph.x - 3, HY + HH + 3, HW + 6, 2, pulse ? '#f8d030' : '#e0a020');
      c.font = '5px "Press Start 2P"';
      c.fillStyle = '#3a2a1a';
      c.fillText('"BAKERY" →', ph.x + 6, HY - 6);
    }
    // carrier with letter
    const walking = this.phase !== 'react';
    const frame = walking ? 1 + (Math.floor(t * 8) % 2) : 0;
    const dir = this.phase === 'back' ? 'left' : this.phase === 'react' ? 'up' : 'right';
    const cy = STREET_Y - 2;
    this.carrier.draw(c, dir, frame, this.x, cy - (frame ? 1 : 0));
    if (this.phase !== 'back') {
      rect(c, this.x + 10, cy + 6, 8, 6, '#2a1e1a');
      rect(c, this.x + 11, cy + 7, 6, 4, '#fff8e8');
      rect(c, this.x + 13, cy + 8, 2, 1, '#c0392b');
    }
    if (this.phase === 'react' && !this.happy) {
      bubble(c, this.x + 4, cy - 18, '?');
      const owner = HOUSES.find((h) => h.slot === this.target)!;
      c.font = '5px "Press Start 2P"';
      c.fillStyle = '#7a2a1a';
      c.fillText(`"I'm the ${owner.label.toLowerCase()}!"`, owner.x + HW / 2 + 4, HY + HH + 13);
    }
    for (const h of this.hearts) heart(c, h.x, h.y, Math.min(1, h.a));
    if (s.solved && this.phase === 'react' && this.happy) {
      c.font = '6px "Press Start 2P"';
      c.fillStyle = '#1e8a4a';
      c.fillText('✓ DELIVERED', 150, 50 + Math.sin(t * 4) * 2);
    }
  }
}

function bubble(c: Ctx, x: number, y: number, ch: string): void {
  rect(c, x - 1, y, 12, 12, '#2a1e1a');
  rect(c, x, y - 1, 10, 14, '#2a1e1a');
  rect(c, x, y + 1, 10, 10, '#fff');
  rect(c, x + 1, y, 8, 12, '#fff');
  c.font = '7px "Press Start 2P"';
  c.fillStyle = '#c0392b';
  c.fillText(ch, x + 2, y + 10);
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
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = 216;
  const c = cv.getContext('2d')!;
  const R = rng(3);
  ['#bfe6ff', '#c9ebff', '#d4efff', '#def3ff'].forEach((col, i) => rect(c, 0, i * 12, W, 12, col));
  rect(c, 0, 48, W, 90, '#5fae4a');
  for (let i = 0; i < 700; i++) rect(c, (R() * W) | 0, 48 + ((R() * 90) | 0), 1, 1, R() < 0.5 ? '#55a042' : '#6dbd55');
  rect(c, 0, STREET_Y + 6, W, 80, '#d9b77a');
  for (let i = 0; i < 900; i++) rect(c, (R() * W) | 0, STREET_Y + 6 + ((R() * 80) | 0), 1, 1, R() < 0.5 ? '#c9a466' : '#e6c890');
  rect(c, 0, STREET_Y + 6, W, 1, '#b8955c');
  tree(c, 40, 92);
  tree(c, 128, 100);
  tree(c, 288, 104);
  // the little post office on the left
  house(c, -18, 70, 62, 66, { roof: '#3b6fb5', wall: '#f0d6a8', label: 'POST' });
  for (const h of HOUSES) {
    house(c, h.x, HY, HW, HH, { roof: h.roof, wall: h.wall, label: h.label });
    const px = h.x + HW / 2 - 7;
    const py = HY + 48;
    rect(c, px, py, 14, 8, '#2a1e1a');
    rect(c, px + 1, py + 1, 12, 6, '#f8f0d8');
    c.font = '5px "Press Start 2P"';
    c.fillStyle = '#2a1e1a';
    c.fillText(h.slot.padStart(2, ' '), px + 2, py + 7);
    rect(c, h.x + HW / 2 - 6, HY + HH, 12, 6, '#c9a466');
  }
  return cv;
}

export const post1: SortLevel = {
  meta: getLevel('post-1'),
  briefing: {
    title: 'THE SORTING WALL',
    text: 'People in Ninefold don\'t remember house numbers. They ask the Post Office for a NAME, and the sorting wall tells them which NUMBER to walk to. Watch the mail carrier, then fix the wall: drag a name onto the right house (or tap a name, then tap a house).',
  },
  puzzle: {
    items: ['bakery', 'library', 'butcher', 'school'],
    slots: ['3', '7', '9', '12'],
    initial: { bakery: '7', library: '3', butcher: '7', school: '9' },
    answer: { bakery: '12', library: '3', butcher: '7', school: '9' },
  },
  itemLabel: { bakery: 'BAKERY', library: 'LIBRARY', butcher: 'BUTCHER', school: 'SCHOOL' },
  slotLabel: { '3': 'No. 3', '7': 'No. 7', '9': 'No. 9', '12': 'No. 12' },
  wrongHint: 'Hmm, that\'s not who lives there. Look at the shop signs on the houses.',
  lesson: {
    headline: 'You just fixed a DNS record.',
    mapping: [
      ['The sorting wall', 'DNS (the Domain Name System)'],
      ['A shop name', 'A domain name, like bakery.town'],
      ['A house number', 'An IP address, like 10.0.3.12'],
      ['One line on the wall', 'An A record'],
    ],
    realWorld: `$ dig +short bakery.town
10.0.3.7          ← the butcher!

# town.zone
- bakery   IN  A   10.0.3.7
+ bakery   IN  A   10.0.3.12`,
    realWorldCaption: 'In Act 2 the wall shows real records, and you\'ll find that fixes take time to spread (TTL).',
  },
  makeStage: () => new PostStage(),
};
