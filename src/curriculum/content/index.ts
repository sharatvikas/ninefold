import type { LevelSpec } from '../spec';
import { POST } from './post';
import { RAIL } from './rail';
import { ARCH } from './arch';
import { HARBOR } from './harbor';
import { WATCH } from './watch';
import { LOCK } from './lock';
import { GRANARY } from './granary';
import { HALL } from './hall';
import { BIG } from './big';
import { STARTERS } from './starters';

export const ALL_SPECS: LevelSpec[] = [...STARTERS, ...POST, ...RAIL, ...ARCH, ...HARBOR, ...WATCH, ...LOCK, ...GRANARY, ...HALL, ...BIG];
