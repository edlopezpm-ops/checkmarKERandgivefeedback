export type Episode = { id: string; duration: number; weight: number };
export type Clock = {
  now(): number;
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
};
export const browserClock: Clock = {
  now: () => performance.now(),
  set: (callback, delay) => window.setTimeout(callback, delay),
  clear: handle => window.clearTimeout(handle as number),
};

export function chooseScene<T extends Episode>(items: readonly T[], previous: string | undefined, random = Math.random): T {
  const choices = items.filter(item => item.id !== previous && item.weight > 0);
  if (!choices.length) throw new Error('At least two enabled scenes are required');
  let ticket = random() * choices.reduce((total, item) => total + item.weight, 0);
  return choices.find(item => (ticket -= item.weight) < 0) ?? choices[choices.length - 1];
}

/** A single timeout owns each wait or episode. Hidden time never accumulates. */
export class EpisodeScheduler<T extends Episode> {
  private timer: unknown;
  private due = 0;
  private remaining = 0;
  private previous?: string;
  private current?: T;
  private paused = false;
  private disposed = false;
  private callback: () => void = () => {};
  private clock: Clock;
  private items: readonly T[];
  private onStart: (scene: T) => void;
  private onEnd: () => void;
  private random: () => number;

  constructor(items: readonly T[], onStart: (scene: T) => void, onEnd: () => void, clock = browserClock, random = Math.random) {
    this.items = items; this.onStart = onStart; this.onEnd = onEnd; this.clock = clock; this.random = random;
  }
  start(paused = false) { this.paused = paused; this.wait(); }
  private schedule(delay: number, callback: () => void) {
    this.clock.clear(this.timer); this.remaining = delay; this.callback = callback;
    if (!this.paused && !this.disposed) {
      this.due = this.clock.now() + delay;
      this.timer = this.clock.set(() => { this.timer = undefined; callback(); }, delay);
    }
  }
  private wait() { this.schedule(30_000 + this.random() * 30_000, () => this.play(chooseScene(this.items, this.previous, this.random))); }
  play(scene: T) {
    if (this.disposed || this.paused) return;
    if (this.current) this.onEnd();
    this.current = scene; this.previous = scene.id; this.onStart(scene);
    this.schedule(scene.duration, () => { this.current = undefined; this.onEnd(); this.wait(); });
  }
  setPaused(paused: boolean) {
    if (this.paused === paused || this.disposed) return;
    if (paused) { this.remaining = Math.max(0, this.due - this.clock.now()); this.clock.clear(this.timer); this.timer = undefined; }
    this.paused = paused;
    if (!paused) this.schedule(this.remaining, this.callback);
  }
  dispose() { this.disposed = true; this.clock.clear(this.timer); this.timer = undefined; this.current = undefined; }
}
