> Public projection published 2026-10-26. Results describe the original audit, before this repository publication. Local paths and private operational metadata are removed; product findings, uncertainty and scores are preserved. See [PUBLICATION.json](PUBLICATION.json).

# marKER — auditoría de integridad funcional

26 de octubre de 2026 · America/New_York  
Snapshot: `77bbedaccc6bc410364cef16fba1ed88b1eaf5e1`  
Rama: `codex/analytics-source-20261025` · Git limpio al inicio y al cierre.

**Veredicto: FAIL.** Hay un incumplimiento funcional menor confirmado: Studio presenta un mensaje fijo en español cuando la interfaz está en inglés. No se observó manipulación del evaluador, adaptación indebida a fixtures ni simulación productiva presentada como ejecución real. La autoría e intención de los cambios no están determinadas.

Outcome: DONE_WITH_CONCERNS  
Delivery state: AUDITORÍA_COMPLETA_DEL_ALCANCE_VERIFICABLE  
Product state: FALLO_MENOR_ABIERTO_Y_CINCO_CAPACIDADES_UNKNOWN  
Gate/authority state: SIN_REPARACIONES_NI_DESPLIEGUES_NI_ESCRITURAS_PROD_NI_CAMBIOS_GIT

**Puntuación reproducible.** Dieciséis capacidades, peso total 60. Los pesos se propusieron antes de revisar resultados; el archivo físico se guardó después de una observación estática sobre la ruta editorial antigua, posteriormente refutada, y antes de ejecutar pruebas o confirmar F01. No se alteraron pesos según los resultados. [Matriz](MATRIX.json) conserva esa cronología y el hash del registro original inmutable.

| Medida | Cálculo | Resultado |
| --- | --- | --- |
| Cumplimiento demostrado D | 34 / 60 | 56.67% |
| Cobertura de decisión C | (34 + 3) / 60 | 61.67% |
| Fallo confirmado ponderado | 3 / 60 | 5.00% |
| Pendiente ponderado | 23 / 60 | 38.33% |

W = P + F + U = 60 = 34 + 3 + 23. Hay diez capacidades PASS, una FAIL y cinco UNKNOWN. UNKNOWN permanece en el denominador: **falta de demostración no equivale a defecto**. El peso 3 corresponde a C12 completa; sus otras comprobaciones correctas no compensan el incumplimiento obligatorio. Estos pesos son una política de auditoría, no una escala científica, probabilidad de engaño ni estimación de todos los defectos. [SCORECARD.json](SCORECARD.json) y [script de cálculo](repro/calculate_score.py) conservan resultados sin redondear y verifican la igualdad de pesos con la matriz congelada.

**Qué funciona y con qué evidencia.** El flujo nativo se ejercitó con entradas nuevas, sin agente: producto → original → clasificación → planificador → receta → FFmpeg real → revisión y aprobación → exportación. El MP4 resultante tiene 1080 × 1920 píxeles, H.264 y 5 segundos; ffprobe lo valida y FFmpeg lo decodifica completo. Tras detener e iniciar Vite, los registros y el MP4 mantienen sus valores y SHA. El original descargado coincide con un SHA calculado independientemente. CAS, fingerprint forjado, aprobación falsa y exportación sin revisión vigente se rechazan; editar la receta invalida la aprobación. También se verificaron límites y persistencia de Settings. [Evidencia nativa](evidence/backend-native/result.json).

OAuth/MCP local recorrió DCR, PKCE, consentimiento, token y 14 herramientas. Una herramienta llegó al backend nativo y guardó un producto durable. Replay no duplica efectos; argumentos diferentes con el mismo operation ID se rechazan; alcance insuficiente y revocación impiden acceso. Una instancia nueva conserva identidad, grant y recibo. Esto acredita el conector local, sin atribuirlo a una campaña real desde ChatGPT o Dot. [Evidencia MCP](evidence/backend-mcp.json).

El driver independiente de acceso y datos comprobó las 13 migraciones con claves foráneas, código de email ligado al navegador, replay, identidad y tenant resueltos en servidor, policy gate, Unicode y CAS, nueva conexión SQLite, perfil con fallo de escritura 503 y conservación del estado previo, seis rutas anónimas y con tenant ajeno, y un export JSON abierto y comparado con los registros. Analytics pasó HMAC mediante crypto independiente, rechazo de campos y fallo central explícito con transporte sintético. El borrado sintético mantuvo retry ante fallo, bloqueó escrituras tardías y dejó vacías 37 tablas y su almacén de objetos simulado. Son nueve comprobaciones. Un error inicial de conteo de fases del driver se corrigió antes de juzgar el producto; su salida se preserva. [Evidencia root](evidence/root-contracts.json).

La admisión hospedada se ejercitó con SQL real en SQLite y R2/processor sintéticos: reservas, probe de 5 centavos, render de 10, enqueue fallido con recibo durable, resume sin doble cargo, reutilización exacta, fallo terminal sin devolución del crédito, liberación de reservas y ledger de 25 centavos persistente en una conexión nueva. Esto no se presenta como ejecución del toolchain real de Cloudflare. [Evidencia de admisión](evidence/backend-hosted/result.json).

En Edge local se verificaron idioma inicial EN, cambio a ES y persistencia tras recarga, contenido guardado intacto, ayuda con imagen cargada y ancho de 390 px sin desbordamiento. La animación cambia píxeles al reproducir, los conserva al pausar y respeta movimiento reducido. Caché inicialmente vacía, opt-in y revocación funcionaron. Se comprobaron 15 guías, 79 pasos y 158 referencias bilingües, sin afirmar inspección visual completa de cada captura. [Recibo frontend](contracts/result.json).

La demo local de 55 segundos buscó el segundo 20 y presentó un frame en 20,033 s, sin error y con pista de subtítulos. Se abrió `/demo/index.html`, porque el servidor Vite dirige `/demo/` a su SPA. Ambos MP4 originales pasaron ffprobe y comparaciones contra sus bytes reales para rangos 206, rechazos 416, HEAD e If-Range. Esta evidencia no acredita el CDN ni el despliegue actual. [Seek en navegador](evidence/frontend-demo-seek.log), [rangos y archivos reales](evidence/root-demo-real-files.json).

**Incumplimientos, dudas y debilidades.** Cada registro de [FINDINGS.json](FINDINGS.json) contiene requisito, ubicaciones, configuración, trayectoria, entrada, resultado esperado y observado, reproducción, impacto, alternativas y corrección propuesta.

| ID | Estado | Resultado |
| --- | --- | --- |
| F01 | CONFIRMED · CONTRACT_FAILURE · menor | Con interfaz EN y formulario de campaña desactualizado, el rechazo CAS muestra «Space cambió. Recarga antes de guardar.». La protección y el borrador funcionan. |
| F02 | SUSPECTED · SPEC_AMBIGUITY | ACK 200 con false o cuerpo vacío deja active/applied 31; 503 o excepción deja confirmation_pending/null. Falta el esquema autoritativo para determinar si false es un rechazo contractual. |
| F03 | CONFIRMED · WEAK_TEST · menor | npm test no prepara módulos generados; una prueba depende de un archivo privado no versionado. La preparación y un sentinel sintético permiten ejecutar todo sin editar fuentes. |
| F04 | CONFIRMED · WEAK_TEST · menor | Ante la mutación de Range, un stream infinito puede colgar la prueba. Cleanup puede ocultar una assertion de persistencia. Los verificadores externos detectaron ambos casos. |
| F05 | Observación documental | console.md describe creación editorial anterior; la ayuda actual distingue earlier records. La API legacy y el flujo principal Studio funcionan. No se demuestra obligación actual de recuperar la entrada antigua. |

F01 atraviesa [Studio.tsx](../../source/src/console/Studio.tsx) líneas 51–56, 146 y 253, y [ErrorNotice.tsx](../../source/src/console/ErrorNotice.tsx) línea 13. El contrato de idioma está en docs/console.md:3. El error es texto fijo del servidor, no contenido del usuario. [Captura](evidence/frontend-english-studio-conflict.png) y [árbol accesible](evidence/frontend-english-studio-conflict.yml) permiten reproducir y revisar el hallazgo.

Un revisor con contexto fresco confirmó F01 y rebajó F02 a incertidumbre. Ejecutó cinco casos sintéticos con fetch global bloqueado y cero solicitudes externas. El fixture acknowledged:true no constituye por sí solo un contrato. El estado Analytics puede habilitar controles visuales, pero no es credencial ni autorización durable; grants y eventos vuelven a leer configuración y el central conserva permisos y versiones. No se demostró bypass. F02 no recibe peso FAIL. [Refutación](refutation.json).

F03 y F04 permanecen como debilidades de prueba. C15 conserva PASS para su compromiso congelado de build, tipos y assets: se recuperó evidencia confiable sin ocultar los fallos originales ni usar un timeout como aprobación.

**Ejecución y fiabilidad de evaluación.** Node 24.18.0, npm 12.0.2, Python 3.13.4, TypeScript 5.9.3, Vite 7.3.7 y Wrangler 4.152.0. Se revisaron completos los 45 archivos de tests, 6.390 líneas, junto con scripts, mocks, hooks y cinco diffs históricos seleccionados. No se observaron filtros, skips, .only, supresión de salidas fallidas ni mecanismo de falsear el juicio. Los cambios legítimos de fixtures, SSR o mocks se separaron de manipulación. No se midió cobertura de líneas o ramas.

| Ejecución | Resultado | Duración |
| --- | --- | --- |
| Suite inicial, antes de preparar generados | 323 descubiertos; 321 PASS, 2 FAIL | 15,33 s |
| Suite preparada en copia externa | 333 descubiertos; 330 PASS, 3 FAIL | 14,39 s |
| Suite final con entorno declarado | 333/333 PASS; 0 skip, cancelados o todo | 13,67 s |
| Build completo, tipos y logo | exit 0 | 6,95 s |
| Worker dry-run sin despliegue | exit 0 | 1,16 s |

Los fallos intermedios se conservaron. La prueba de archivo privado requería un sentinel existente; el watcher nativo emitió un evento add real, pero no satisfizo su comprobación interna de indexación. Polling en Windows y un sentinel privado sintético resolvieron esos problemas del entorno/harness sin editar producto. Build generó los módulos legítimos del processor antes de la suite final. Los 333 incluyen padres y subtests. [Comandos, entornos, códigos, duraciones y hashes](evaluation/runs.json), [análisis de integridad](evaluation/result.json).

Se introdujeron tres mutaciones dirigidas en copia desechable: omitir escritura durable, ignorar Range y omitir aprobación. El verificador externo detectó las tres: cero supervivientes, inválidos, timeouts o no cubiertos; se restauraron sus hashes. La suite nativa produjo una assertion directa, un rechazo con error de cleanup y un timeout terminado manualmente. El timeout no recibe crédito como assertion. Otro auditor corroboró persistencia; sus repeticiones no aumentan cobertura ni constituyen un mutation score global. [Estados brutos](evaluation/mutations.json), [segundo control](evidence/backend-negative.json).

**Inventario, configuración y cobertura.** Se fijaron 368 archivos versionados, 35.957.965 bytes, y 298 archivos locales relevantes ignorados. El inventario versionado es 368/368; la revisión semántica del texto propio es 191/191. Ese denominador excluye public/assets y binarios, lock revisado estructuralmente y declaraciones generadas de plataforma. No equivale a porcentaje de capacidades o de líneas ejecutadas. [Cobertura por archivo](COVERAGE.json), [inventario y exclusiones](INVENTORY.json).

Se incluyeron frontend React/TypeScript, backend Fetch, persistencia local JSON/SQLite, Worker D1/R2/DO/Container, cron, migraciones D1 y PostgreSQL inactivo, integraciones, tests, herramientas, documentación y configuración oculta. No se redujo el alcance al diff. No hay submódulos ni CI versionada; los hooks Git encontrados son muestras inactivas. El lock contiene 232 entradas; las diez dependencias directas instaladas coinciden con él y sus resoluciones usan HTTPS e integrity. No hubo instalación o actualización. No se revisó semánticamente todo vendor, ni se ejecutó un audit de vulnerabilidades de dependencias. Las dependencias se reutilizaron mediante junction: esto no es contención de OS ni un manifiesto de todos sus cachés generados.

Las imágenes, fuentes, atlas y películas se inventariaron y verificaron mediante estructura y muestras declaradas. No se afirma revisión visual de cada imagen o frame. De worker-configuration.d.ts se revisaron bindings iniciales; las declaraciones de runtime generadas no se trataron como código propio. De .dev.vars solo se registraron nombres, tamaño y hash; no se copiaron valores. No se abrieron datos del propietario en .local/.wrangler ni credenciales personales. La gobernanza se leyó únicamente para operar y queda excluida de evaluación.

**Estados finales.** No se aumentó peso subdividiendo comprobaciones.

| ID | Capacidad | Peso | Estado |
| --- | --- | --- | --- |
| C01 | Consola editorial manual, CAS y entrega confirmada | 5 | PASS |
| C02 | Space: originales, clasificación y derechos | 5 | PASS |
| C03 | Planificador nativo y procedencia | 5 | PASS |
| C04 | Preview real, aprobación exacta y exportación | 5 | PASS |
| C05 | Admisión hospedada, cuotas y recibos | 5 | UNKNOWN |
| C06 | Acceso único, sesiones y tenant retenido | 5 | UNKNOWN |
| C07 | Perfil, políticas y borrado reanudable | 5 | UNKNOWN |
| C08 | MCP OAuth, herramientas acotadas y revocación | 5 | PASS |
| C09 | Agents y bridge local opcional | 3 | UNKNOWN |
| C10 | Ajustes guardados y CAS | 3 | PASS |
| C11 | Analytics central, propósitos separados y derechos | 5 | UNKNOWN |
| C12 | Interfaz bilingüe, Ambiente y ayuda | 3 | FAIL |
| C13 | Decoración, identidad y caché opcional | 1 | PASS |
| C14 | Demo pública, rangos y subtítulos | 1 | PASS |
| C15 | Build, tipos, assets y runtime | 3 | PASS |
| C16 | Simulación explícita e integraciones inactivas | 1 | PASS |

Los 23 pesos UNKNOWN corresponden a C05, C06, C07, C09 y C11. Faltan sandboxes reales de R2/Container, email/OAuth/CAPTCHA, borrado externo, inferencia local y contrato/efecto central Analytics. Las dependencias sintéticas solo acreditan el recorrido que ejercitan. No se usaron escrituras en producción para suplir esas carencias.

La campaña de un host externo, teléfonos físicos y micrófonos/codecs, calidad creativa, ahorro de tiempo, costos reales, recuperación y despliegue actual no se acreditan aquí. Las funciones expresamente diferidas —publicación social, activación pagada, inferencia hospedada, análisis hospedado y Android nativo— no se penalizan por ausencia. Tampoco se dispone de una especificación original completa y cerrada: se evalúan los compromisos vigentes documentados, sin certificar toda intención original posible.

**Correcciones prioritarias y continuidad.** Formalizar ACK y comprobar su recibo en un sandbox antes de usarlo como señal operativa; no inventar un esquema. Corregir F01 mediante códigos de error traducidos en una frontera común, preservando validación y texto guardado. Verificar nuevos conflictos y errores de derechos en EN/ES. Hacer autónomos y acotados los tests F03/F04, conservando assertions y cleanup; alinear documentación antigua. Resolver después los entornos UNKNOWN con datos sintéticos y lectura independiente del efecto. Toda corrección requiere un snapshot nuevo y casos nuevos; esta versión no fue reparada.

Contratos/frontend, comportamiento/backend e integridad de evaluación trabajaron por separado con contexto heredado; la refutación de candidatos tuvo contexto fresco. Compartieron workspace y no estuvieron aislados por OS. Los resultados se contrastaron con archivos, comandos y efectos; consenso de agentes no sustituye reproducción. No se infiere aceptación humana o nueva UAT. [PROGRESS.json](PROGRESS.json) conserva todas las áreas y el siguiente paso concreto.

**Custodia y reproducción.** Los 666 archivos originales registrados mantienen sus hashes; HEAD y estado Git coinciden. [PRESERVATION.json](PRESERVATION.json). Solo se escribieron artefactos privados de auditoría y copias desechables; ningún cambio al código evaluado, despliegue, migración remota, commit o push.

[evidence/](evidence) contiene logs depurados y archivos abiertos/decodificados; [repro/](repro) contiene drivers. Para recalcular y verificar custodia:

```powershell
python "audit/2026-10-26\repro\calculate_score.py"
python "audit/2026-10-26\repro\verify_preservation.py"
```

Los replays de backend requieren un sufijo nuevo según backend/result.json. La suite completa requiere build previo, FFmpeg, sentinel privado sintético y CHOKIDAR_USEPOLLING=1 en este entorno Windows; no copiar gobernanza real para fabricar fixtures. El bundle usa perfil CLI vacío, métricas desactivadas y `--dry-run --containers-rollout none` ([referencia oficial](https://developers.cloudflare.com/workers/wrangler/commands/)). El harness D1 reproduce transacciones locales según el [contrato de batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), sin afirmar equivalencia con toda la plataforma. Verificar fuente, artefacto construido y despliegue son comprobaciones diferentes; aquí se ejercitaron los dos primeros.
