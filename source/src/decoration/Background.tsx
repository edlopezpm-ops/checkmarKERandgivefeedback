import { useEffect, useRef, type CSSProperties } from 'react';
import { EpisodeScheduler } from './scheduler';
import { scenes, type Scene } from './registry';
import { Stage } from './renderer';
import type { DecorativeAssets } from './assets';

export type PlaybackState = { phase: 'rest' | 'playing' | 'paused' | 'reduced'; scene?: string };

export default function Background({ assets, preview, paused = false, width = 384, margin = 18, openingScene, onState }: {
  assets: DecorativeAssets; preview?: { id: string; nonce: number }; paused?: boolean; width?: number; margin?: number;
  openingScene?: string; onState?: (state: PlaybackState) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef<{ play(id: string): void; visibility(): void } | null>(null);
  const pausedRef = useRef(paused);
  const stateRef = useRef(onState);
  pausedRef.current = paused;
  stateRef.current = onState;

  useEffect(() => {
    const element = canvas.current!;
    const stage = new Stage(element);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, frame = 0, token = 0, lastPaint = 0, started = 0;
    let pausedAt: number | undefined;
    let running: Awaited<ReturnType<Scene['load']>> | undefined;
    let current: Scene | undefined;
    let blobUrl: string | undefined;
    const isPaused = () => document.hidden || pausedRef.current;
    const report = () => {
      const phase = media.matches ? 'reduced' : isPaused() ? 'paused' : current ? 'playing' : 'rest';
      element.dataset.phase = phase;
      element.dataset.scene = current?.id ?? '';
      stateRef.current?.({ phase, scene: current?.label });
    };
    const stopFrames = () => { cancelAnimationFrame(frame); frame = 0; };
    const resumeFrames = () => { if (!frame && running && !isPaused() && !media.matches) frame = requestAnimationFrame(tick); };
    function tick(now: number) {
      frame = 0;
      if (disposed || !running || !current || isPaused() || media.matches) return;
      if (now - lastPaint >= 1000 / 24) {
        running.frame(stage, Math.min(1, (now - started) / current.duration));
        lastPaint = now;
      }
      resumeFrames();
    }
    function finish() {
      token++;
      stopFrames();
      running?.finish(stage);
      running = undefined;
      current = undefined;
      stage.idle();
      if (!disposed) report();
    }
    const scheduler = new EpisodeScheduler(scenes, scene => {
      finish();
      const request = token;
      current = scene;
      started = performance.now();
      lastPaint = 0;
      report();
      void scene.load().then(loaded => {
        if (disposed || request !== token || media.matches) return;
        running = loaded;
        loaded.start(stage);
        loaded.frame(stage, 0);
        resumeFrames();
      }).catch(() => finish());
    }, finish);

    function visibility() {
      if (isPaused()) {
        if (pausedAt === undefined) pausedAt = performance.now();
        stopFrames();
        scheduler.setPaused(true);
      } else {
        if (pausedAt !== undefined) { started += performance.now() - pausedAt; pausedAt = undefined; }
        scheduler.setPaused(media.matches);
        resumeFrames();
      }
      report();
    }
    function motion() {
      finish();
      if (media.matches) scheduler.setPaused(true);
      else scheduler.start(isPaused());
      report();
    }
    const play = (id: string) => {
      if (media.matches || isPaused()) return;
      const scene = scenes.find(item => item.id === id);
      if (scene) scheduler.play(scene);
    };
    controls.current = { play, visibility };
    stage.idle();
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', motion);
    scheduler.start(media.matches || isPaused());
    report();
    // Immediate demonstration only in local review. The normal build waits 30–60 s.
    if (import.meta.env.DEV && openingScene) play(openingScene);
    void assets.load().then(blob => {
      if (disposed) return;
      blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { if (!disposed) { stage.sprites = img; if (!running) stage.idle(); } };
      img.src = blobUrl;
    }).catch(() => { /* Inline pixel art works without a network/cache. */ });
    return () => {
      disposed = true;
      scheduler.dispose();
      finish();
      controls.current = null;
      document.removeEventListener('visibilitychange', visibility);
      media.removeEventListener('change', motion);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [assets, openingScene]);

  useEffect(() => { controls.current?.visibility(); }, [paused]);
  useEffect(() => { if (preview) controls.current?.play(preview.id); }, [preview]);
  const style = { '--scene-width': `${width}px`, '--scene-margin': `${margin}px` } as CSSProperties;
  return <div className="decoration" aria-hidden="true" inert style={style}><canvas ref={canvas} width="384" height="216" /></div>;
}
