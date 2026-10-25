# Product map

- [Overview](README.md): supported behavior and commands.
- [Console](docs/console.md): manual workflows, limits and environment requirements.
- [Architecture](docs/architecture.md): local and prepared hosted boundaries.
- [Decoration](docs/decoration.md): original identity and existing animation.
- [Implementation next steps](docs/implementation-next-steps.md): three fictional test scenarios, acceptance checks and ordered remaining capabilities.
- [AI connection decision](docs/ai-connection-decision.md): selected Sign in with ChatGPT evaluation, hosted-app eligibility requirements and the generation contract.
- [Local text simulation](docs/text-simulation.md): development-only source selection, simulated review/save, limits and pending live connection.
- [Hosted Studio](docs/hosted-studio.md): private owner media/assembly API, storage, processing credits, recovery and mobile limits.
- [Rule-based assembly](docs/studio-planner.md): proposal planner, editable recipe provenance, optional technical analysis, prepared hosted gate and pilot limits.
- [Settings](docs/settings.md): owner-saved budgets/storage/default duration, revision conflicts, device Environment and inactive future AI allocation.
- [MCP connector](docs/mcp-connector.md): scoped delegated assistant tools, native planning, retry receipts, private export and connection revocation; source verification is separate from hosted/client activation.
- `src/core/`: typed records, deterministic commands and browser API client.
- `src/console/`: editorial modules and forms.
- `src/console/Help.tsx`: contextual and continuous product guides; `src/i18n.tsx`: English/Spanish interface strings and browser preference.
- `src/decoration/`: character renderer, scenes, scheduler and optional cache.
- `server/`: shared Fetch API, local file repository, prepared Supabase adapter and Worker.
- `migrations-d1/`: applied private auth/workspace schema for the domain-test release.
- `migrations/`: inactive PostgreSQL/Supabase preparation.
- `server/native-auth*`: namespaced email-code owner access; `server/d1.ts`: hosted CAS repository.
- `tests/`: editorial/API/access and animation/cache verification.
- `vite.config.ts`: loopback-only development API; private paths denied.
- `public/brand/`: unmodified logo, integrity manifest; `public/decoration/`: hosted pixel art.
- `public/help/`: English/Spanish component screenshots with synthetic examples; `public/fonts/`: supplied Montserrat WOFF2 assets and original OFL.
- `assets/`: attribution assets and license.
# Studio files

- `src/core/studio.ts`: raw-material library, typed templates, recipe/source versions, rights and approval/export rules, separate from legacy Post delivery.
- `src/console/Studio.tsx`, `src/console/studio.css`: shared local/hosted Space capture/classification and Campaign assembly, preview and export.
- `server/studio-local.ts`, `server/studio-render.ts`: native local SQLite/files, resumable uploads/jobs, FFprobe metadata and bounded FFmpeg montage.
- `migrations-d1/0002_studio.sql`: entity schema applied with the hosted Studio release.
- `tests/studio*.test.ts`: domain, storage/API, native media and actual Vite HTTP verification.
- `docs/local-studio.md`: earlier local-increment setup and limits; current hosted behavior is documented in `docs/hosted-studio.md`.

Hosted follow-up: `server/entry.ts` exports the existing Worker and `StudioProcessor`; `server/studio-hosted.ts` implements D1/R2 media and job APIs. `server/studio-processor.ts`, `processor/runner.mjs` and `tools/prepare-processor.mjs` reuse the exact renderer through bounded native container streams. Additive migrations `0002_studio.sql` through `0005_studio_settings.sql` provide the hosted schema. Production includes Studio, the rule-based planner and Settings; technical analysis stays disabled until the hosted toolchain is verified.

Additional source boundaries: migrations `0006`–`0009` provide the Agents ledger,
single-owner email/Google/GitHub identity and profile/account lifecycle. Migration
`0010_mcp.sql` adds scoped connector authorization and effect receipts; its
production activation is separate from this source increment. `server/mcp.ts`
owns transport/receipts, `server/mcp-auth*` OAuth, `server/mcp-tools.ts` the finite
backend adapter and `server/mcp-local.ts` isolated local authorization storage.
`src/console/McpConnections.tsx` provides Environment connection management.
