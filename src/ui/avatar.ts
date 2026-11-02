import { drawCharacter, type Dir, type HairStyle, type Hat, type Look } from '../art/characters';
import type { Avatar } from '../state/progress';
import { h } from './ui';

export const PRESETS: Avatar[] = [
  { name: 'Sam', look: { skin: '#f1c27d', hair: '#5a3a22', hairStyle: 'short', hat: 'cap', hatColor: '#c0392b', shirt: '#2b6cb0', accent: '#ffffff', pants: '#2d3748' } },
  { name: 'Priya', look: { skin: '#b07850', hair: '#1a1214', hairStyle: 'long', hat: 'none', hatColor: '#2f8f8a', shirt: '#2f8f8a', accent: '#f8d030', pants: '#3a3a4a' } },
  { name: 'Kai', look: { skin: '#8a5a3a', hair: '#2a1a1a', hairStyle: 'curly', hat: 'beanie', hatColor: '#e8a030', shirt: '#e07030', accent: '#ffffff', pants: '#2a2a3a' } },
  { name: 'Mo', look: { skin: '#e8c8a0', hair: '#e8c060', hairStyle: 'spiky', hat: 'none', hatColor: '#27ae60', shirt: '#27ae60', accent: '#1a3a2a', pants: '#4a3a2a' } },
  { name: 'Lee', look: { skin: '#f6d0b0', hair: '#6a3a8a', hairStyle: 'bun', hat: 'none', hatColor: '#7a4fa0', shirt: '#7a4fa0', accent: '#f8f0d8', pants: '#2d3748' } },
  { name: 'Ash', look: { skin: '#d8a070', hair: '#b04020', hairStyle: 'long', hat: 'beret', hatColor: '#2a2a3a', shirt: '#c0392b', accent: '#f8d030', pants: '#3a2a1a' } },
];

const SKINS = ['#f6d0b0', '#f1c27d', '#e8b48a', '#d8a070', '#b07850', '#8a5a3a', '#5e3a24'];
const HAIR_COLORS = ['#1a1214', '#3a2a1a', '#5a3a22', '#8a5a2a', '#e8c060', '#b04020', '#6a3a8a', '#b0b0b0'];
const CLOTHES = ['#2b6cb0', '#2f8f8a', '#27ae60', '#e8a030', '#e07030', '#c0392b', '#7a4fa0', '#e07a9a', '#2a2a3a', '#f4f0e6'];
const PANTS = ['#2d3748', '#3a2a1a', '#4a3a2a', '#2a2a3a', '#5a4a6a', '#3a5a8a'];
const STYLES: [HairStyle, string][] = [['short', 'Short'], ['long', 'Long'], ['bun', 'Bun'], ['curly', 'Curly'], ['spiky', 'Spiky'], ['bald', 'Bald']];
const HATS: [Hat, string][] = [['none', 'None'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['hardhat', 'Hard hat'], ['beret', 'Beret'], ['chef', 'Chef']];
const DIRS: Dir[] = ['down', 'left', 'up', 'right'];

/** Draw a character large and crisp on its own canvas (used for previews). */
function paint(cv: HTMLCanvasElement, look: Look, dir: Dir, frame: number): void {
  const rectBox = cv.getBoundingClientRect();
  const px = Math.max(32, Math.round(rectBox.width * (window.devicePixelRatio || 1)));
  if (cv.width !== px) {
    cv.width = px;
    cv.height = px;
  }
  const c = cv.getContext('2d')!;
  const k = px / 40; // 40 logical units across: the 32-grid character plus headroom
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, px, px);
  c.setTransform(k, 0, 0, k, 0, 0);
  c.imageSmoothingEnabled = false;
  drawCharacter(c, look, dir, frame, 4, 6, 1);
}

export class AvatarCreator {
  readonly el = h('div', 'modal hidden avatar-modal');
  open = false;
  private look: Look = { ...PRESETS[0].look };
  private name = PRESETS[0].name;
  private preview = h('canvas', 'avatar-preview') as HTMLCanvasElement;
  private raf = 0;
  private onDone: ((a: Avatar) => void) | undefined;
  private cancellable = false;

  show(current: Avatar | undefined, onDone: (a: Avatar) => void): void {
    this.look = { ...(current?.look ?? PRESETS[0].look) };
    this.name = current?.name ?? '';
    this.cancellable = !!current;
    this.onDone = onDone;
    this.open = true;
    this.render();
    this.el.classList.remove('hidden');
    const t0 = performance.now();
    const loop = (now: number) => {
      if (!this.open) return;
      const t = (now - t0) / 1000;
      const dir = DIRS[Math.floor(t / 1.6) % 4];
      paint(this.preview, this.look, dir, 1 + (Math.floor(t * 6) % 2));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  close(): void {
    this.open = false;
    cancelAnimationFrame(this.raf);
    this.el.classList.add('hidden');
  }

  private render(): void {
    this.el.replaceChildren();
    const card = h('div', 'panel avatar-card');
    const left = h('div', 'avatar-left');
    const nameInput = h('input', 'text avatar-name') as HTMLInputElement;
    nameInput.placeholder = 'Your name';
    nameInput.maxLength = 16;
    nameInput.value = this.name;
    nameInput.addEventListener('input', () => (this.name = nameInput.value));
    left.append(this.preview, nameInput);

    const right = h('div', 'avatar-right');
    // presets
    const presets = h('div', 'presets');
    for (const p of PRESETS) {
      const b = h('button', 'preset');
      const cv = h('canvas', 'preset-cv') as HTMLCanvasElement;
      b.append(cv, h('span', '', p.name));
      b.addEventListener('click', () => {
        this.look = { ...p.look };
        if (!this.name || PRESETS.some((x) => x.name === this.name)) this.name = p.name;
        this.render();
      });
      presets.append(b);
      requestAnimationFrame(() => paint(cv, p.look, 'down', 0));
    }
    right.append(h('div', 'sub', 'PICK A STARTING LOOK'), presets, h('div', 'sub', 'OR MAKE IT YOURS'));

    const row = (label: string, ctrl: HTMLElement) => {
      const r = h('div', 'arow');
      r.append(h('span', 'k', label), ctrl);
      right.append(r);
    };
    const swatches = (cols: string[], key: keyof Look) => {
      const box = h('div', 'swatches');
      for (const col of cols) {
        const b = h('button', `swatch ${this.look[key] === col ? 'on' : ''}`);
        b.style.background = col;
        b.title = col;
        b.addEventListener('click', () => {
          (this.look as unknown as Record<string, string>)[key] = col;
          box.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === b));
        });
        box.append(b);
      }
      return box;
    };
    const choices = <T extends string>(opts: [T, string][], key: 'hairStyle' | 'hat') => {
      const box = h('div', 'choices');
      for (const [val, label] of opts) {
        const b = h('button', `opt ${this.look[key] === val ? 'on' : ''}`, label);
        b.addEventListener('click', () => {
          (this.look as unknown as Record<string, string>)[key] = val;
          box.querySelectorAll('.opt').forEach((x) => x.classList.toggle('on', x === b));
        });
        box.append(b);
      }
      return box;
    };
    row('SKIN', swatches(SKINS, 'skin'));
    row('HAIR', choices(STYLES, 'hairStyle'));
    row('HAIR COLOUR', swatches(HAIR_COLORS, 'hair'));
    row('HAT', choices(HATS, 'hat'));
    row('HAT COLOUR', swatches(CLOTHES, 'hatColor'));
    row('TOP', swatches(CLOTHES, 'shirt'));
    row('TROUSERS', swatches(PANTS, 'pants'));

    const actions = h('div', 'avatar-actions');
    if (this.cancellable) {
      const cancel = h('button', 'btn', 'CANCEL');
      cancel.addEventListener('click', () => this.close());
      actions.append(cancel);
    }
    const go = h('button', 'btn primary', this.cancellable ? 'SAVE ✓' : "LET'S GO ▶");
    go.addEventListener('click', () => {
      const avatar: Avatar = { name: this.name.trim().slice(0, 16) || 'On-call', look: { ...this.look } };
      this.close();
      this.onDone?.(avatar);
    });
    actions.append(go);
    right.append(actions);

    card.append(h('div', 'title', this.cancellable ? 'YOUR AVATAR' : "WHO'S ON CALL TODAY?"), h('div', 'avatar-body'));
    const body = card.lastChild as HTMLElement;
    body.append(left, right);
    this.el.append(card);
  }
}
