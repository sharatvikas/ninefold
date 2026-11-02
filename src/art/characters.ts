import { Layer, makeCanvas, RENDER, snap, sprite, type Ctx, type Palette } from './pixels';

export type Dir = 'down' | 'up' | 'left' | 'right';

/** Colours that make one character look different from another. */
export interface Look {
  hat: string; // hat or hair-top colour
  hatHi: string;
  hair: string;
  skin: string;
  shirt: string;
  accent: string;
  pants: string;
}

// k outline, c/C hat, h hair, s skin, S skin shade, b shirt, w accent, p pants
const HEAD_DOWN = [
  '....kkkkkkk.....',
  '...kcCCCCCck....',
  '..kcCwCCCCCck...',
  '..kkkkkkkkkkk...',
  '..khssssssshk...',
  '..kssksssksk....',
  '..kssssssssk....',
  '...kssSSssk.....',
  '..kbbbwwbbbk....',
  '.kbbbbwwbbbbk...',
  '.ksbbbbbbbbsk...',
  '.ksbbbbbbbbsk...',
];
const HEAD_UP = [
  '....kkkkkkk.....',
  '...kcCCCCCck....',
  '..kcCCCCCCCck...',
  '..kkkkkkkkkkk...',
  '..khhhhhhhhhk...',
  '..khhhhhhhhhk...',
  '..khhhhhhhhhk...',
  '...khhhhhhhk....',
  '..kbbbbbbbbbk...',
  '.kbbbbbbbbbbbk..',
  '.ksbbbbbbbbbsk..',
  '.ksbbbbbbbbbsk..',
];
const HEAD_LEFT = [
  '....kkkkkkk.....',
  '...kcCCCCCCk....',
  '..kCCCCCCCCck...',
  '.kkkkkkkkkkkk...',
  '...ksshhhhhk....',
  '...kskshhhhk....',
  '...kssshhhhk....',
  '....ksshhhk.....',
  '....kbbbbbk.....',
  '...kbbbbbbbk....',
  '...kbbsbbbbk....',
  '...kbbsbbbbk....',
];
const LEGS_FRONT = [
  ['..kppppppppk....', '..kppk..kppk....', '..kppk..kppk....', '..kkk....kkk....'],
  ['..kppppppppk....', '..kppk..kppk....', '..kkk...kppk....', '........kkk.....'],
  ['..kppppppppk....', '..kppk..kppk....', '..kppk...kkk....', '..kkk...........'],
];
const LEGS_SIDE = [
  ['....kpppppk.....', '....kpppppk.....', '....kppkppk.....', '....kkk.kkk.....'],
  ['....kpppppk.....', '...kppk.kppk....', '..kppk...kppk...', '..kkk.....kkk...'],
  ['....kpppppk.....', '....kpppppk.....', '.....kppk.......', '.....kkkk.......'],
];

function palette(l: Look): Palette {
  return { k: '#2a1e1a', c: l.hat, C: l.hatHi, h: l.hair, s: l.skin, S: shadeSkin(l.skin), b: l.shirt, w: l.accent, p: l.pants };
}
function shadeSkin(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, v - 30);
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

const DIRS: Dir[] = ['down', 'up', 'left', 'right'];

/** A pre-rendered 4-direction x 3-frame sheet of 16x16 sprites. */
export class CharacterSheet {
  private layer: Layer;

  constructor(look: Look) {
    this.layer = new Layer(() => CharacterSheet.build(look));
  }

  private static build(look: Look): HTMLCanvasElement {
    const [cv, c] = makeCanvas(16 * 3, 16 * 4);
    const pal = palette(look);
    DIRS.forEach((dir, row) => {
      for (let f = 0; f < 3; f++) {
        const x = f * 16;
        const y = row * 16;
        const flip = dir === 'right';
        const head = dir === 'down' ? HEAD_DOWN : dir === 'up' ? HEAD_UP : HEAD_LEFT;
        const legs = dir === 'down' || dir === 'up' ? LEGS_FRONT[f] : LEGS_SIDE[f];
        sprite(c, head, x, y, pal, 1, flip);
        sprite(c, legs, x, y + 12, pal, 1, flip);
      }
    });
    return cv;
  }

  draw(c: Ctx, dir: Dir, frame: number, x: number, y: number): void {
    const row = DIRS.indexOf(dir);
    const k = RENDER.scale;
    c.drawImage(this.layer.get(), frame * 16 * k, row * 16 * k, 16 * k, 16 * k, snap(x), snap(y), 16, 16);
  }
}

export const LOOKS = {
  player: { hat: '#c0392b', hatHi: '#e05a48', hair: '#5a3a22', skin: '#f1c27d', shirt: '#2b6cb0', accent: '#ffffff', pants: '#2d3748' },
  rosa: { hat: '#f4f0e6', hatHi: '#ffffff', hair: '#7a3b1e', skin: '#e8b48a', shirt: '#f4f0e6', accent: '#c0392b', pants: '#5a4a6a' },
  finn: { hat: '#e8c030', hatHi: '#f8e070', hair: '#3a2a1a', skin: '#c68a5a', shirt: '#e08838', accent: '#ffffff', pants: '#2d3748' },
  ines: { hat: '#2f4f8f', hatHi: '#4a70b8', hair: '#1a1a1a', skin: '#a8704a', shirt: '#2f4f8f', accent: '#f8d030', pants: '#2a2a3a' },
  ada: { hat: '#2f8f8a', hatHi: '#58c0b8', hair: '#c8a060', skin: '#f6d0b0', shirt: '#e2e6ee', accent: '#2f8f8a', pants: '#3a3a4a' },
  bo: { hat: '#3a2a1a', hatHi: '#5a4a3a', hair: '#9a9a9a', skin: '#f1c27d', shirt: '#b5523b', accent: '#f8d030', pants: '#3a2a1a' },
  lin: { hat: '#4a3a6a', hatHi: '#6a5a9a', hair: '#1a1a2a', skin: '#e8c8a0', shirt: '#6a5a9a', accent: '#ffe680', pants: '#2a2a3a' },
  kit: { hat: '#7a4fa0', hatHi: '#a07ac8', hair: '#d06030', skin: '#f6d0b0', shirt: '#3a3a4a', accent: '#c0c0c0', pants: '#2a2a3a' },
  juno: { hat: '#c0392b', hatHi: '#f05a48', hair: '#2a1a1a', skin: '#8a5a3a', shirt: '#2a2a3a', accent: '#f8d030', pants: '#3a2a1a' },
  gus: { hat: '#c8a040', hatHi: '#e8c860', hair: '#6a4a2a', skin: '#d8a070', shirt: '#4a7a3a', accent: '#c8a040', pants: '#5a3a1a' },
} satisfies Record<string, Look>;
