import { Layer, makeCanvas, RENDER, rect, shade, snap, type Ctx } from './pixels';

export type Dir = 'down' | 'up' | 'left' | 'right';
export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'spiky' | 'bald';
export type Hat = 'none' | 'cap' | 'beanie' | 'hardhat' | 'chef' | 'beret';

/** Everything that makes one character look different from another. */
export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  hat: Hat;
  hatColor: string;
  shirt: string;
  accent: string;
  pants: string;
}

const OUT = '#2a1e1a';
const SHOE = '#3a2a2a';
const EYE = '#241a18';

/**
 * Draw one character frame. The art is designed on a 32×32 grid; `u` is the size of one
 * grid cell in logical pixels (0.5 = a 16×16 logical sprite with double detail).
 */
export function drawCharacter(c: Ctx, L: Look, dir: Dir, frame: number, x: number, y: number, u = 0.5): void {
  // Frame 3 is the standing pose with eyes closed (a blink).
  const blink = frame === 3;
  if (blink) frame = 0;
  const flip = dir === 'right';
  const R = (px: number, py: number, w: number, h: number, col: string) => {
    const fx = flip ? 32 - px - w : px;
    rect(c, x + fx * u, y + py * u, w * u, h * u, col);
  };
  const O = (px: number, py: number, w: number, h: number, col: string) => {
    R(px - 1, py - 1, w + 2, h + 2, OUT);
    R(px, py, w, h, col);
  };
  const b = frame > 0 ? 1 : 0; // body bob while walking
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const shirtDark = shade(L.shirt, -30);
  const pantsDark = shade(L.pants, -25);
  const skinDark = shade(L.skin, -35);

  R(9, 30, 14, 2, 'rgba(0,0,0,0.22)'); // shadow

  if (dir === 'down' || dir === 'up') {
    const liftL = frame === 1 ? 2 : 0;
    const liftR = frame === 2 ? 2 : 0;
    O(11, 23, 4, 6 - liftL, L.pants);
    O(17, 23, 4, 6 - liftR, L.pants);
    R(11, 28 - liftL, 4, 2, SHOE);
    R(17, 28 - liftR, 4, 2, SHOE);
    R(11, 23, 1, 5 - liftL, pantsDark);
    O(6, 16 - b + swing, 3, 6, L.shirt);
    O(23, 16 - b - swing, 3, 6, L.shirt);
    R(6, 22 - b + swing, 3, 2, L.skin);
    R(23, 22 - b - swing, 3, 2, L.skin);
    O(9, 15 - b, 14, 9, L.shirt);
    R(9, 21 - b, 14, 3, shirtDark);
    R(9, 23 - b, 14, 1, pantsDark);
    if (dir === 'down') {
      R(14, 15 - b, 4, 2, L.accent);
      R(15, 17 - b, 2, 4, L.accent);
    }
    O(9, 3 - b, 14, 12, L.skin);
    R(9, 13 - b, 14, 2, skinDark);
    if (dir === 'down') {
      R(12, 8 - b, 2, 3, EYE);
      R(18, 8 - b, 2, 3, EYE);
      R(12, 8 - b, 1, 1, '#ffffff');
      R(18, 8 - b, 1, 1, '#ffffff');
      R(10, 11 - b, 2, 1, '#f0a0a0');
      R(20, 11 - b, 2, 1, '#f0a0a0');
      R(15, 12 - b, 2, 1, shade(L.skin, -70));
      if (blink) {
        R(12, 8 - b, 2, 3, L.skin);
        R(18, 8 - b, 2, 3, L.skin);
        R(12, 10 - b, 2, 1, EYE);
        R(18, 10 - b, 2, 1, EYE);
      }
    }
    hairFrontBack(R, O, L, dir === 'up', b);
    hatFrontBack(R, O, L, dir === 'up', b);
  } else {
    const stride = frame === 1 ? 2 : frame === 2 ? -2 : 0;
    O(13 + stride, 23, 4, 6, pantsDark);
    R(13 + stride, 28, 4, 2, SHOE);
    O(15 - stride, 23, 4, 6, L.pants);
    R(14 - stride, 28, 5, 2, SHOE);
    O(11, 15 - b, 10, 9, L.shirt);
    R(11, 21 - b, 10, 3, shirtDark);
    R(11, 23 - b, 10, 1, pantsDark);
    O(14 + swing, 16 - b, 4, 6, shade(L.shirt, -12));
    R(14 + swing, 22 - b, 4, 2, L.skin);
    O(10, 3 - b, 13, 12, L.skin);
    R(10, 13 - b, 13, 2, skinDark);
    R(8, 9 - b, 2, 2, L.skin);
    R(12, 8 - b, 2, 3, EYE);
    R(12, 8 - b, 1, 1, '#ffffff');
    if (blink) {
      R(12, 8 - b, 2, 3, L.skin);
      R(12, 10 - b, 2, 1, EYE);
    }
    R(12, 11 - b, 2, 1, '#f0a0a0');
    R(19, 8 - b, 2, 3, skinDark);
    hairSide(R, O, L, b);
    hatSide(R, O, L, b);
  }
}

type Fill = (px: number, py: number, w: number, h: number, col: string) => void;

function hairFrontBack(R: Fill, O: Fill, L: Look, back: boolean, b: number): void {
  const h = L.hair;
  const hd = shade(h, -30);
  const hl = shade(h, 30);
  switch (L.hairStyle) {
    case 'bald':
      R(12, 4 - b, 4, 1, shade(L.skin, 25));
      return;
    case 'short':
    case 'bun':
    case 'long':
      R(9, 1 - b, 14, 1, OUT);
      R(8, 2 - b, 16, 4, h);
      R(8, 2 - b, 2, back ? 9 : 6, h);
      R(22, 2 - b, 2, back ? 9 : 6, h);
      if (back) R(9, 5 - b, 14, 6, h);
      else {
        R(10, 6 - b, 6, 2, h);
        R(18, 6 - b, 4, 1, h);
      }
      R(11, 2 - b, 6, 1, hl);
      if (L.hairStyle === 'long') {
        O(7, 5 - b, 3, 12, h);
        O(22, 5 - b, 3, 12, h);
        if (back) O(9, 8 - b, 14, 9, h);
        R(7, 14 - b, 3, 2, hd);
        R(22, 14 - b, 3, 2, hd);
      }
      if (L.hairStyle === 'bun') {
        O(13, -2 - b, 6, 4, h);
        R(14, -2 - b, 2, 1, hl);
      }
      return;
    case 'curly':
      R(7, -1 - b, 18, 1, OUT);
      R(6, 0 - b, 20, 6, h);
      R(6, 5 - b, 3, back ? 9 : 6, h);
      R(23, 5 - b, 3, back ? 9 : 6, h);
      if (back) R(8, 5 - b, 16, 8, h);
      for (let i = 0; i < 6; i++) R(7 + i * 3, 1 - b + (i % 2), 2, 2, hd);
      R(10, 0 - b, 4, 1, hl);
      return;
    case 'spiky':
      for (let i = 0; i < 5; i++) {
        R(8 + i * 3, -1 - b + (i % 2), 3, 3, h);
        R(9 + i * 3, -2 - b + (i % 2), 1, 1, OUT);
      }
      R(8, 2 - b, 16, 4, h);
      R(8, 2 - b, 2, 5, h);
      R(22, 2 - b, 2, 5, h);
      if (back) R(9, 5 - b, 14, 5, h);
      R(11, 2 - b, 4, 1, hl);
      return;
  }
}

function hatFrontBack(R: Fill, O: Fill, L: Look, back: boolean, b: number): void {
  const c = L.hatColor;
  const cd = shade(c, -35);
  switch (L.hat) {
    case 'none':
      return;
    case 'cap':
      O(8, 0 - b, 16, 5, c);
      R(8, 3 - b, 16, 2, cd);
      if (!back) {
        R(7, 5 - b, 18, 2, cd);
        R(15, 1 - b, 2, 2, L.accent);
      }
      return;
    case 'beanie':
      O(8, -1 - b, 16, 7, c);
      for (let i = 0; i < 8; i++) R(9 + i * 2, 4 - b, 1, 2, cd);
      O(15, -3 - b, 2, 2, L.accent);
      return;
    case 'hardhat':
      O(8, 0 - b, 16, 5, '#f8c030');
      R(15, -1 - b, 2, 6, '#ffe070');
      R(6, 5 - b, 20, 2, '#d8a020');
      return;
    case 'chef':
      O(10, -6 - b, 12, 9, '#ffffff');
      R(11, -6 - b, 4, 2, '#f0f0f0');
      R(9, 2 - b, 14, 3, '#e8e8e8');
      R(9, 2 - b, 14, 1, OUT);
      return;
    case 'beret':
      O(7, 0 - b, 17, 4, c);
      O(21, -1 - b, 4, 2, c);
      R(7, 3 - b, 17, 1, cd);
      return;
  }
}

function hairSide(R: Fill, O: Fill, L: Look, b: number): void {
  const h = L.hair;
  const hl = shade(h, 30);
  switch (L.hairStyle) {
    case 'bald':
      R(14, 4 - b, 4, 1, shade(L.skin, 25));
      return;
    case 'curly':
      R(9, 0 - b, 16, 6, h);
      R(17, 5 - b, 7, 8, h);
      for (let i = 0; i < 4; i++) R(10 + i * 4, 1 - b, 2, 2, shade(h, -30));
      return;
    case 'spiky':
      for (let i = 0; i < 4; i++) R(12 + i * 3, -1 - b + (i % 2), 3, 3, h);
      R(10, 2 - b, 14, 4, h);
      R(18, 5 - b, 5, 5, h);
      return;
    default:
      R(10, 1 - b, 13, 1, OUT);
      R(10, 2 - b, 14, 4, h);
      R(18, 5 - b, 6, 7, h);
      R(10, 6 - b, 3, 1, h);
      R(13, 2 - b, 5, 1, hl);
      if (L.hairStyle === 'long') O(19, 6 - b, 5, 12, h);
      if (L.hairStyle === 'bun') O(20, 0 - b, 5, 5, h);
  }
}

function hatSide(R: Fill, O: Fill, L: Look, b: number): void {
  const c = L.hatColor;
  const cd = shade(c, -35);
  switch (L.hat) {
    case 'none':
      return;
    case 'cap':
      O(10, 0 - b, 14, 5, c);
      R(5, 4 - b, 7, 2, cd);
      return;
    case 'beanie':
      O(10, -1 - b, 14, 7, c);
      O(17, -3 - b, 2, 2, L.accent);
      return;
    case 'hardhat':
      O(10, 0 - b, 14, 5, '#f8c030');
      R(7, 5 - b, 19, 2, '#d8a020');
      return;
    case 'chef':
      O(11, -6 - b, 12, 9, '#ffffff');
      R(10, 2 - b, 14, 3, '#e8e8e8');
      return;
    case 'beret':
      O(9, 0 - b, 16, 4, c);
      R(9, 3 - b, 16, 1, cd);
      return;
  }
}

const DIRS: Dir[] = ['down', 'up', 'left', 'right'];

/** A cached 4-direction × 4-frame sheet (stand, step, step, blink) of 16×16 (logical) sprites with 32-grid detail. */
export class CharacterSheet {
  private layer: Layer;

  constructor(private look: Look) {
    this.layer = new Layer(() => CharacterSheet.build(this.look));
  }

  setLook(look: Look): void {
    this.look = look;
    this.layer = new Layer(() => CharacterSheet.build(this.look));
  }

  private static build(look: Look): HTMLCanvasElement {
    // 3 logical px of headroom above each frame for hats and buns
    const [cv, c] = makeCanvas(16 * 4, 19 * 4);
    DIRS.forEach((dir, row) => {
      for (let f = 0; f < 4; f++) drawCharacter(c, look, dir, f, f * 16, row * 19 + 3, 0.5);
    });
    return cv;
  }

  draw(c: Ctx, dir: Dir, frame: number, x: number, y: number): void {
    const row = DIRS.indexOf(dir);
    const k = RENDER.scale;
    c.drawImage(this.layer.get(), frame * 16 * k, row * 19 * k, 16 * k, 19 * k, snap(x), snap(y - 3), 16, 19);
  }
}

export const LOOKS = {
  player: { skin: '#f1c27d', hair: '#5a3a22', hairStyle: 'short', hat: 'cap', hatColor: '#c0392b', shirt: '#2b6cb0', accent: '#ffffff', pants: '#2d3748' },
  rosa: { skin: '#e8b48a', hair: '#7a3b1e', hairStyle: 'bun', hat: 'chef', hatColor: '#ffffff', shirt: '#f4f0e6', accent: '#c0392b', pants: '#5a4a6a' },
  finn: { skin: '#c68a5a', hair: '#3a2a1a', hairStyle: 'short', hat: 'hardhat', hatColor: '#f8c030', shirt: '#e08838', accent: '#f8f8f8', pants: '#2d3748' },
  ines: { skin: '#a8704a', hair: '#1a1a1a', hairStyle: 'long', hat: 'cap', hatColor: '#2f4f8f', shirt: '#2f4f8f', accent: '#f8d030', pants: '#2a2a3a' },
  ada: { skin: '#f6d0b0', hair: '#c8a060', hairStyle: 'bun', hat: 'none', hatColor: '#2f8f8a', shirt: '#2f8f8a', accent: '#e2e6ee', pants: '#3a3a4a' },
  bo: { skin: '#f1c27d', hair: '#b0b0b0', hairStyle: 'bald', hat: 'none', hatColor: '#3a2a1a', shirt: '#b5523b', accent: '#f8d030', pants: '#3a2a1a' },
  lin: { skin: '#e8c8a0', hair: '#1a1a2a', hairStyle: 'long', hat: 'none', hatColor: '#4a3a6a', shirt: '#6a5a9a', accent: '#ffe680', pants: '#2a2a3a' },
  kit: { skin: '#f6d0b0', hair: '#d06030', hairStyle: 'spiky', hat: 'none', hatColor: '#7a4fa0', shirt: '#7a4fa0', accent: '#c0c0c0', pants: '#2a2a3a' },
  gus: { skin: '#d8a070', hair: '#6a4a2a', hairStyle: 'curly', hat: 'beret', hatColor: '#5a7a3a', shirt: '#4a7a3a', accent: '#c8a040', pants: '#5a3a1a' },
  juno: { skin: '#8a5a3a', hair: '#2a1a1a', hairStyle: 'curly', hat: 'none', hatColor: '#c0392b', shirt: '#2a2a3a', accent: '#f8d030', pants: '#3a2a1a' },
} satisfies Record<string, Look>;
