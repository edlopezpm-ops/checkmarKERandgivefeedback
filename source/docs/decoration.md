# marKER decorative scene

Run `npm install` and `npm run dev` for the local review. `npm test` checks timing, optional caching, directional art and motion. `npm run build` also verifies the immutable logo against its manifest.

## Identity and page background

`public/brand/marker-logo-v1.png` is the complete approved 1942×809 image. Do not recreate, crop, stretch, recolor, mask, filter or reduce its opacity. Its original margins and descriptor are part of the image. `tools/verify-assets.mjs` checks its SHA-256 and dimensions. A future replacement requires a separately authorized new version.

The page's mineral color and subtle procedural SVG texture live in `src/style.css`, behind the image. The page texture does not modify the logo. The remaining interface is a minimal local review surface, not a marketing console.

## Placement and timing

`Background` accepts `width` (default 384 CSS pixels), `margin` (18), and `paused`. Its logical Canvas stays 384×216. CSS anchors it to the lower right, respects safe areas and reduces its width on narrow/short viewports. Playback/status controls live inside **Ambiente**, together with about/help and pause; there is no external debug/replay strip. The entire image, props and shadows stay inside the arena. The reference scale sketch was unavailable; these are configurable implementation dimensions, not a verified match to that sketch.

The production build waits a random 30–60 seconds before the first episode, then waits another 30–60 seconds after each episode finishes. Only one episode runs. Selection avoids immediate repetition of a scene. **Ambiente** can manually play any scene and pause/resume; reduced motion prevents playback. The local development review starts one kung fu demonstration; `?autoplay=0` suppresses that development-only opening. The environment menu is available in normal builds.

After authentication, the toolbar and complete logo remain in a sticky header ending beneath the logo canvas. Header and page share one color and viewport-aligned texture, with no header border or shadow. The browser tab uses the separately supplied cropped brand asset embedded unchanged in `marker-tab-v1.svg`, with rounded transparent corners; the main logo remains unchanged.

Rest has no animation-frame loop. Hidden-tab and explicit workload pauses preserve remaining time without catch-up. Reduced motion displays a static composition and prevents previews. The **Ambiente** control can disable the decoration and releases its timers/listeners. The decorative layer is `aria-hidden`, `inert`, `pointer-events: none` and below application content; its controls are separate.

## Art and new scenes

- `renderer.ts` owns two distinct pixel silhouettes, four real torso projections per character (`front`, `threeQuarter`, `side`, `back`), expressions, articulated arms/legs and subtle shadows. Profile geometry is narrower; back views have no facial features. `torsoPixels` supplies the inline fallback for the hosted SVG atlas.
- `characters-v2.svg` contains eight directional torso frames. Limb poses and expressions are composited at runtime. Rotations supplement these real projections; they do not replace side/back art.
- `scenes.ts` owns interpolated travel, airborne motion, facing/depth and choreography. `sampleScene(id, progress, variant)` samples a deterministic episode; `createScene` selects a variant once at start. Scene time never calls an AI service.
- `registry.ts` declares IDs, labels, versions, weights, durations, resources and draw-only start/frame/finish lifecycles. The repertoire is kung fu, swords, toy lasers, stones, tennis, grill, dance and cueca. Codex wins competitive scenes; grill, dance and cueca are cooperative. Add a scene here and supply its drawing routine without changing the scheduler.

Choose **Cueca** in **Environment / Ambiente** (also available in Settings), then **Play / Reproducir**. Claude and Codex wear scene-only huaso hats, striped ponchos and boots, wave white handkerchiefs, circle each other and alternate their feet in a zapateo before the closing salute. Clothing is drawn in Canvas over the unchanged directional torso art and disappears when the episode returns to rest. The scene has no sound and uses the same pause, hidden-tab and reduced-motion controls as the other activities.

Keep all particles, props and limbs bounded, including transformed extremities. Update the hosted atlas when changing fallback torso geometry and verify pixel equivalence. Version the asset URL and cache name when changing art.

## Optional local resources

Resources originate from the host and load into memory without optional persistent writes by default. After authentication, **Copia local de recursos** opts into the component's Cache Storage namespace, capped at 5 MB. It is optional and starts off; signing in does not grant consent. Revocation and logout remove only that namespace, including old versions, serialized after in-flight writes. HTTP browser caching remains independent. Unavailable storage, quota limits or a lost copy fall back to the host; failed network loading leaves identifiable inline art. No service worker, protected persistent-storage request, credential storage or AI provider is involved.
