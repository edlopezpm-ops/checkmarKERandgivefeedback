import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Explicit single public source. No recursive packaging, local media, executables or private files.
await mkdir(resolve("processor"), { recursive: true });
await copyFile(resolve("server/studio-render.ts"), resolve("processor/studio-render.generated.txt"));
await copyFile(resolve("server/studio-analysis.ts"), resolve("processor/studio-analysis.generated.txt"));
await copyFile(resolve("src/core/studio-analysis.ts"), resolve("processor/studio-analysis-core.generated.txt"));
