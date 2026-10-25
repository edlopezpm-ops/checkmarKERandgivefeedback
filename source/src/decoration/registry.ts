import type { Episode } from './scheduler';
import { SPRITES_URL } from './assets';
import type { Stage } from './renderer';
export type Scene = Episode & {
  label: string; version: number; resources: readonly string[]; winner?: 'codex';
  load(): Promise<{ start(stage: Stage): void; frame(stage: Stage, progress: number): void; finish(stage: Stage): void }>;
};
const entries = [
  ['kungfu', 'Kung fu', 14500, true],
  ['swords', 'Espaditas', 12000, true], ['lasers', 'Láser de juguete', 11000, true],
  ['stones', 'Piedritas', 11000, true], ['tennis', 'Tenis', 12000, true],
  ['grill', 'Parrilla', 13000, false], ['dance', 'Baile', 12000, false],
  ['cueca', 'Cueca', 20000, false],
] as const;
export const scenes: readonly Scene[] = entries.map(([id, label, duration, competitive]) => ({
  id, label, duration, weight: id === 'kungfu' ? 2 : 1, version: 2, resources: [SPRITES_URL], winner: competitive ? 'codex' : undefined,
  load: async () => { const { createScene } = await import('./scenes'); return createScene(id, competitive); },
}));
