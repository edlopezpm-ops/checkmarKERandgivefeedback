# Animation, branding and Help

Current source: 26 October 2026, `77bbedac`.

[Background](../source/src/decoration/Background.tsx) coordinates [scheduler](../source/src/decoration/scheduler.ts), [scenes](../source/src/decoration/scenes.ts), [renderer](../source/src/decoration/renderer.ts), [registry](../source/src/decoration/registry.ts) and [asset lifecycle](../source/src/decoration/assets.ts). Off/reduced motion/pause/cache choices remain distinct. Animation code inspection and byte hashes do not prove temporal quality.

[Help](../source/src/console/Help.tsx) renders [guide definitions](../source/src/console/help-guides.ts) with public synthetic screenshots. Authentication help uses a separately guarded mail request, not these authenticated guides. Original [logo](../source/public/brand/marker-logo-v1.png), [brand manifest](../source/public/brand/manifest.json), [fonts/license](../source/public/fonts/) and [AEKR attribution](../source/assets/) remain included.

In the audit's real local Edge context, playing changed canvas pixels; pause preserved them; reduced-motion produced a static composition and disabled Play. CacheStorage began empty, opt-in wrote the decoration namespace only and revocation removed it. Language persisted through reload without changing synthetic saved text. Help's 15 guides/79 steps/158 bilingual image references were integrity-checked; an ES mobile guide was opened and its image inspected. This does not claim semantic visual inspection of every capture or physical-device acceptance.

The global language control is now the header EN/ES button. Some guide text still points to older Environment language/policy placement; that documentary drift is distinguished from the confirmed Studio error-language defect. [Current audit](../12-functional-integrity-audit.md).
