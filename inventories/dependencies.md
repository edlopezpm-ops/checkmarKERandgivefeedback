# Dependency and command reference

Derived from committed `package.json` and lockfile version 3. Versions describe the frozen lockfile, not hosted installation or an advisory scan. Optional platform variants may not be installed.

## Direct dependencies

| Class | Package | Declared range | Exact locked version |
| --- | --- | --- | --- |
| runtime | react | ^19.2.0 | 19.3.1 |
| runtime | react-dom | ^19.2.0 | 19.3.1 |
| development | @types/node | ^26.6.5 | 26.6.5 |
| development | @types/react | ^19.2.0 | 19.3.0 |
| development | @types/react-dom | ^19.2.0 | 19.3.0 |
| development | typescript | ^5.9.3 | 5.9.3 |
| development | vite | ^7.1.12 | 7.3.7 |
| development | wrangler | ^4.152.0 | 4.152.0 |

## Product commands

| Script | Command |
| --- | --- |
| dev | `vite --host 127.0.0.1` |
| build | `node tools/prepare-processor.mjs && tsc --noEmit && tsc -p tsconfig.server.json --noEmit && vite build && node tools/verify-assets.mjs` |
| types:worker | `wrangler types` |
| preview | `vite preview --host 127.0.0.1` |
| test | `node --experimental-strip-types --test tests/*.test.ts` |
| verify:assets | `node tools/verify-assets.mjs` |

These commands describe the product. The documentary publication did not run product tests, builds, Wrangler, deployment or provider execution.

## Complete lock inventory

| Lock path | Exact version | Dev | Optional | License |
| --- | --- | --- | --- | --- |
| `node_modules/@cloudflare/kv-asset-handler` | 0.5.0 | True | False | MIT OR Apache-2.0 |
| `node_modules/@cloudflare/unenv-preset` | 2.16.2 | True | False | MIT OR Apache-2.0 |
| `node_modules/@cloudflare/workerd-darwin-64` | 1.20261019.1 | True | True | Apache-2.0 |
| `node_modules/@cloudflare/workerd-darwin-arm64` | 1.20261019.1 | True | True | Apache-2.0 |
| `node_modules/@cloudflare/workerd-linux-64` | 1.20261019.1 | True | True | Apache-2.0 |
| `node_modules/@cloudflare/workerd-linux-arm64` | 1.20261019.1 | True | True | Apache-2.0 |
| `node_modules/@cloudflare/workerd-windows-64` | 1.20261019.1 | True | True | Apache-2.0 |
| `node_modules/@cspotcode/source-map-support` | 0.8.1 | True | False | MIT |
| `node_modules/@emnapi/runtime` | 1.11.3 | True | True | MIT |
| `node_modules/@esbuild/aix-ppc64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/android-arm` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/android-arm64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/android-x64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/darwin-arm64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/darwin-x64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/freebsd-arm64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/freebsd-x64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/linux-arm` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/linux-arm64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/linux-ia32` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/linux-loong64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/linux-mips64el` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/linux-ppc64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/linux-riscv64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/linux-s390x` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/linux-x64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/netbsd-arm64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/netbsd-x64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/openbsd-arm64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/openbsd-x64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/openharmony-arm64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/sunos-x64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/win32-arm64` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/win32-ia32` | 0.28.2 | True | True | MIT |
| `node_modules/@esbuild/win32-x64` | 0.28.2 | True | True | MIT |
| `node_modules/@img/colour` | 1.1.0 | True | False | MIT |
| `node_modules/@img/sharp-darwin-arm64` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-darwin-x64` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-freebsd-wasm32` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-libvips-darwin-arm64` | 1.3.4 | True | True | LGPL-3.0-or-later |
| `node_modules/@img/sharp-libvips-darwin-x64` | 1.3.4 | True | True | LGPL-3.0-or-later |
| `node_modules/@img/sharp-libvips-linux-arm` | 1.3.4 | True | True | LGPL-3.0-or-later |
| `node_modules/@img/sharp-libvips-linux-arm64` | 1.3.4 | True | True | LGPL-3.0-or-later |
| `node_modules/@img/sharp-libvips-linux-ppc64` | 1.3.4 | True | True | LGPL-3.0-or-later |
| `node_modules/@img/sharp-libvips-linux-riscv64` | 1.3.4 | True | True | LGPL-3.0-or-later |
| `node_modules/@img/sharp-libvips-linux-s390x` | 1.3.4 | True | True | LGPL-3.0-or-later |
| `node_modules/@img/sharp-libvips-linux-x64` | 1.3.4 | True | True | LGPL-3.0-or-later |
| `node_modules/@img/sharp-libvips-linuxmusl-arm64` | 1.3.4 | True | True | LGPL-3.0-or-later |
| `node_modules/@img/sharp-libvips-linuxmusl-x64` | 1.3.4 | True | True | LGPL-3.0-or-later |
| `node_modules/@img/sharp-linux-arm` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-linux-arm64` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-linux-ppc64` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-linux-riscv64` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-linux-s390x` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-linux-x64` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-linuxmusl-arm64` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-linuxmusl-x64` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-wasm32` | 0.35.5 | True | True | Apache-2.0 AND LGPL-3.0-or-later AND MIT |
| `node_modules/@img/sharp-webcontainers-wasm32` | 0.35.5 | True | True | Apache-2.0 |
| `node_modules/@img/sharp-win32-arm64` | 0.35.5 | True | True | Apache-2.0 AND LGPL-3.0-or-later |
| `node_modules/@img/sharp-win32-ia32` | 0.35.5 | True | True | Apache-2.0 AND LGPL-3.0-or-later |
| `node_modules/@img/sharp-win32-x64` | 0.35.5 | True | True | Apache-2.0 AND LGPL-3.0-or-later |
| `node_modules/@jridgewell/resolve-uri` | 3.1.2 | True | False | MIT |
| `node_modules/@jridgewell/sourcemap-codec` | 1.6.0 | True | False | MIT |
| `node_modules/@jridgewell/trace-mapping` | 0.3.9 | True | False | MIT |
| `node_modules/@napi-rs/lzma-linux-x64-gnu` | 1.5.1 | True | True | MIT |
| `node_modules/@poppinss/colors` | 4.1.6 | True | False | MIT |
| `node_modules/@poppinss/dumper` | 0.6.5 | True | False | MIT |
| `node_modules/@poppinss/exception` | 1.2.3 | True | False | MIT |
| `node_modules/@rollup/rollup-android-arm-eabi` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-android-arm64` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-darwin-arm64` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-darwin-x64` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-freebsd-arm64` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-freebsd-x64` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-arm-gnueabihf` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-arm-musleabihf` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-arm64-gnu` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-arm64-musl` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-loong64-gnu` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-loong64-musl` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-ppc64-gnu` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-ppc64-musl` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-riscv64-gnu` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-riscv64-musl` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-s390x-gnu` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-x64-gnu` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-linux-x64-musl` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-openbsd-x64` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-openharmony-arm64` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-win32-arm64-msvc` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-win32-ia32-msvc` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-win32-x64-gnu` | 4.65.0 | True | True | MIT |
| `node_modules/@rollup/rollup-win32-x64-msvc` | 4.65.0 | True | True | MIT |
| `node_modules/@sindresorhus/is` | 7.2.0 | True | False | MIT |
| `node_modules/@speed-highlight/core` | 1.2.24 | True | False | CC0-1.0 |
| `node_modules/@types/estree` | 1.0.9 | True | False | MIT |
| `node_modules/@types/node` | 26.6.5 | True | False | MIT |
| `node_modules/@types/react` | 19.3.0 | True | False | MIT |
| `node_modules/@types/react-dom` | 19.3.0 | True | False | MIT |
| `node_modules/blake3-wasm` | 2.1.5 | True | False | MIT |
| `node_modules/cookie` | 1.1.1 | True | False | MIT |
| `node_modules/csstype` | 3.2.3 | True | False | MIT |
| `node_modules/detect-libc` | 2.1.2 | True | False | Apache-2.0 |
| `node_modules/error-stack-parser-es` | 1.0.5 | True | False | MIT |
| `node_modules/esbuild` | 0.28.2 | True | False | MIT |
| `node_modules/fdir` | 6.5.0 | True | False | MIT |
| `node_modules/fsevents` | 2.3.3 | True | True | MIT |
| `node_modules/kleur` | 4.1.5 | True | False | MIT |
| `node_modules/miniflare` | 5.20261019.2-beta | True | False | MIT |
| `node_modules/nanoid` | 3.3.20 | True | False | MIT |
| `node_modules/path-to-regexp` | 6.3.0 | True | False | MIT |
| `node_modules/pathe` | 2.0.3 | True | False | MIT |
| `node_modules/picocolors` | 1.1.1 | True | False | ISC |
| `node_modules/picomatch` | 4.0.7 | True | False | MIT |
| `node_modules/postcss` | 8.5.31 | True | False | MIT |
| `node_modules/react` | 19.3.1 | False | False | MIT |
| `node_modules/react-dom` | 19.3.1 | False | False | MIT |
| `node_modules/rollup` | 4.65.0 | True | False | MIT |
| `node_modules/scheduler` | 0.28.0 | False | False | MIT |
| `node_modules/semver` | 7.8.5 | True | False | ISC |
| `node_modules/sharp` | 0.35.5 | True | False | Apache-2.0 |
| `node_modules/source-map-js` | 1.2.2 | True | False | BSD-3-Clause |
| `node_modules/supports-color` | 10.2.2 | True | False | MIT |
| `node_modules/tinyglobby` | 0.2.17 | True | False | MIT |
| `node_modules/tslib` | 2.8.1 | True | True | 0BSD |
| `node_modules/typescript` | 5.9.3 | True | False | Apache-2.0 |
| `node_modules/undici` | 7.29.1 | True | False | MIT |
| `node_modules/undici-types` | 8.9.0 | True | False | MIT |
| `node_modules/unenv` | 2.0.0-rc.24 | True | False | MIT |
| `node_modules/vite` | 7.3.7 | True | False | MIT |
| `node_modules/workerd` | 1.20261019.1 | True | False | Apache-2.0 |
| `node_modules/wrangler` | 4.152.0 | True | False | MIT OR Apache-2.0 |
| `node_modules/ws` | 8.21.0 | True | False | MIT |
| `node_modules/youch` | 4.1.0-beta.10 | True | False | MIT |
| `node_modules/youch-core` | 0.3.3 | True | False | MIT |

Integrity hashes and machine-readable records: [dependencies.json](dependencies.json). Registry URLs are omitted. No new product dependency was introduced by this dossier.
