# Reproducciones frontend (snapshot 77bbedac)

Se usó una copia de los 368 archivos versionados y herramientas autorizadas, sin datos ni credenciales, en `[local-execution-path] Node 24.18.0, Vite 7.3.7, Playwright CLI y Microsoft Edge del equipo. El primer intento con Chrome no pudo abrir porque no está instalado; se cambió explícitamente al Edge instalado. No es un fallo del producto. No hubo llamada al hosted ni inferencia.

## F-UI-01: conflicto de Studio no traducido

1. Iniciar Vite en una copia nueva fuera de `.aekr` con `node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5199`. Datos `.local` nuevos; nunca reutilizar datos del propietario.
2. Abrir `http://127.0.0.1:5199` en un contexto Edge nuevo. Confirmar que el idioma inicial es EN.
3. Products → New product; nombre `AUDIT 20261026 FRONTEND SYNTHETIC`; guardar. Campaigns; seleccionar ese producto; título `AUDIT CAMPAIGN UI STALE`.
4. Mientras la vista conserva la revisión Studio 0, desde una conexión HTTP nueva hacer GET `/api/studio`, después POST `/api/studio/commands` con Origin `http://127.0.0.1:5199`, JSON `{"expectedRevision":0,"command":{"type":"material.save","data":{"title":"AUDIT CONCURRENT INDEPENDENT","kind":"idea","text":"Synthetic independent mutation"}}}`. Leer revisión 1.
5. En la vista original pulsar Create campaign. Resultado real: HTTP409, JSON `{"error":"Space cambió. Recarga antes de guardar.","code":"revision_conflict"}`. La alerta visible contiene ese castellano entre controles ingleses.
6. Oráculo: el contrato de interfaz EN/ES exige que la instrucción de recuperación se muestre en el idioma elegido. Esperado: mensaje equivalente en inglés. No se exige cambiar el código ni relajar CAS. El rechazo de escritura es correcto y no se considera defecto.

Evidencias: `../evidence/frontend-english-studio-conflict.yml` y `.png`. Cadena: `server/studio-local.ts:338` → `src/console/Studio.tsx:57` → `src/console/Studio.tsx:146` → `src/console/ErrorNotice.tsx:13`. `server/studio-hosted.ts:330` devuelve el mismo mensaje en la ruta hosted; eso es corroboración estática, no ejecución hosted.

## Probes independientes adicionales

`node --experimental-strip-types audit/2026-10-26/repro/frontend-independent.mjs` verifica todas las referencias de ayuda EN/ES, PNGs, exclusión auxiliar del simulador en el build y ocho cues VTT. Produce `../evidence/frontend-independent.json`. No certifica semántica visual de cada PNG ni toda la alineación del audio.

En navegador real: EN → ES → reload; título y texto sintéticos intactos; viewport390×844 sin overflow; abrir ayuda de Campañas y comprobar PNG ES cargado. Snapshot/log en `frontend-mobile-language-help.log`.

Decoración: pulsar Reproducir; marcar Pausar animación; comparar `canvas.toDataURL()` antes y después de500ms. Esperado `phase=paused` y bytes iguales. Reanudar y reproducir: `phase=playing` y bytes distintos. Emular `prefers-reduced-motion=reduce`: `phase=reduced`, bytes iguales y Play deshabilitado. Los tres logs conservan las expresiones efectivamente ejecutadas. CacheStorage inicia vacío; opt-in crea solo `marker-decoration-v2` con `/decoration/characters-v2.svg`; revocar deja vacío. No se probó logout hosted ni fallos del almacenamiento real.

Demo: Vite no resuelve el índice de carpeta `/demo/` como Cloudflare Static Assets y devolvió la SPA; se abrió el archivo público explícito `/demo/index.html`. En el `<video>` real: esperar metadata, seek20s, esperar `seeked`, reproducir en muted y esperar `requestVideoFrameCallback`. Se observaron duration55, currentTime20.004168, frameTime20.033333,1920×1080, readyState4, sin error, una pista captions. No se extrapola el routing ni Range de Vite al Worker. `frontend-demo-seek.log` conserva el probe exacto. El coordinador comprueba por separado el handler Range del Worker.

## Oráculos rechazados

La primera versión del probe estático exigía ausencia de la etiqueta `Generar texto simulado` en todo JS. Falló porque el diccionario bilingüe conserva texto no utilizado. Se rechazó ese oráculo: una cadena no demuestra una ruta simulada activa. El probe se limita ahora a marcadores propios del ejecutable de simulación, junto con la inspección del gate DEV. No se atribuyó defecto al producto por esa coincidencia. Un error inicial del script por `%20` se corrigió usando `fileURLToPath`; era instrumentación de auditoría.

## Refutaciones y límites

Las antiguas pantallas de creación editorial ya no son entrada nueva; ayuda vigente y hosted-studio describen las fuentes/campañas anteriores como registros existentes y Studio ofrece el recorrido nuevo. No se confirma DISCONNECTED_IMPLEMENTATION por esa sustitución. `docs/console.md` conserva descripciones antiguas de creación/UTF8; se recomienda reconciliarlas. Help todavía describe English/Español dentro de Environment mientras la interfaz actual usa el botón EN/ES del header; y la ayuda menciona enlaces policy dentro del menú aunque ahora son footer permanente. Son desajustes documentales, no permisos inventados ni simulación.
