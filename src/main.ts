import './style.css';
import { Game, VIEW_H, VIEW_W } from './engine/game';
import { InvestigateScene, SortScene } from './levels/kits/scenes';
import { harbor1 } from './levels/stages/harbor1';
import { post1 } from './levels/stages/post1';
import type { InvestigateLevel, SortLevel } from './levels/types';
import { TownScene, type LevelResult } from './world/TownScene';

const PLAYABLE: Record<string, InvestigateLevel | SortLevel> = {
  'harbor-1': harbor1,
  'post-1': post1,
};

function fitStage(stage: HTMLElement): void {
  const fit = () => {
    const maxW = window.innerWidth - 16;
    const maxH = window.innerHeight - 16;
    const s = Math.min(maxW / VIEW_W, maxH / VIEW_H);
    // Integer scale keeps pixels crisp; fall back to fractional on tiny screens.
    const scale = s >= 1 ? Math.floor(s) : s;
    stage.style.width = `${Math.round(VIEW_W * scale)}px`;
    stage.style.height = `${Math.round(VIEW_H * scale)}px`;
  };
  window.addEventListener('resize', fit);
  fit();
}

async function boot(): Promise<void> {
  const stage = document.getElementById('stage')!;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  fitStage(stage);

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
    const lvl = PLAYABLE[id];
    if (!lvl) return;
    if (lvl.meta.kit === 'investigate') game.setScene(new InvestigateScene(game, lvl as InvestigateLevel, backToTown));
    else game.setScene(new SortScene(game, lvl as SortLevel, backToTown));
  };

  const town = new TownScene(game, startLevel);
  game.setScene(town);
  game.start();
}

void boot();
