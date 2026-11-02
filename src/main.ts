import './style.css';
import { Game, VIEW_H, VIEW_W } from './engine/game';
import { RENDER } from './art/pixels';
import type { Scene } from './engine/game';
import { HarborScene } from './levels/harbor1';
import type { Exit } from './levels/incident';
import { PostScene } from './levels/post1';
import { SpecScene } from './levels/SpecScene';
import { ALL_SPECS } from './levels/content';
import { TownScene, type LevelResult } from './world/TownScene';

/** Every playable level, keyed by catalog id. */
const PLAYABLE: Record<string, (game: Game, exit: Exit) => Scene> = {
  'harbor-1': (g, e) => new HarborScene(g, e),
  'post-1': (g, e) => new PostScene(g, e),
  ...Object.fromEntries(ALL_SPECS.map((spec) => [spec.id, (g: Game, e: Exit) => new SpecScene(g, spec, e)])),
};

/**
 * Fill the window (keeping 16:9) and render the canvas at the display's real resolution,
 * so pixel art stays sharp and text stays crisp on any screen size.
 */
function fitStage(stage: HTMLElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const fit = () => {
    const maxW = window.innerWidth - 16;
    const maxH = window.innerHeight - 16;
    const css = Math.max(0.5, Math.min(maxW / VIEW_W, maxH / VIEW_H));
    const cssW = Math.round(VIEW_W * css);
    const cssH = Math.round(VIEW_H * css);
    stage.style.width = `${cssW}px`;
    stage.style.height = `${cssH}px`;
    // Whole device pixels per game pixel, capped to keep offscreen layers a sane size.
    const k = Math.min(8, Math.max(1, Math.ceil(css * (window.devicePixelRatio || 1))));
    RENDER.scale = k;
    canvas.width = VIEW_W * k;
    canvas.height = VIEW_H * k;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
  };
  window.addEventListener('resize', fit);
  fit();
}

async function boot(): Promise<void> {
  const stage = document.getElementById('stage')!;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  fitStage(stage, canvas, ctx);

  try {
    await Promise.race([document.fonts.load('8px "Press Start 2P"'), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    // Font failed to load: the fallback font still works.
  }

  const game = new Game(ctx, document.getElementById('ui')!);

  const backToTown = (r: LevelResult) => {
    const gained = r.completed ? game.finishLevel(r.levelId, r.trust) : 0;
    game.setScene(town);
    town.returnFrom({ ...r, trust: gained });
  };

  const startLevel = (id: string) => {
    const make = PLAYABLE[id];
    if (make) game.setScene(make(game, backToTown));
  };

  const town = new TownScene(game, startLevel);
  game.setScene(town);
  game.start();

  if (import.meta.env.DEV) {
    // Dev-only hooks for automated play-checks. Not included in production builds.
    (window as unknown as Record<string, unknown>).__ninefold = {
      ids: Object.keys(PLAYABLE),
      start: (id: string) => startLevel(id),
      town: () => game.setScene(town),
      scene: () => game.current,
    };
  }
}

void boot();
