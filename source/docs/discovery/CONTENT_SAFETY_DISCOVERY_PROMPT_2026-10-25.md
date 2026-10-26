# Prompt de discovery · marKER · prevención de contenido y campañas prohibidos

Trabaja en el repositorio canónico de marKER. Esta orden autoriza **discovery y diseño**, no implementar clasificadores, activar bloqueos, suspender usuarios ni enviar contenido a un proveedor. Diseña la prevención posterior de material y campañas contrarios a los ToS en todo el recorrido, incluida la exportación de vídeo, manteniendo una herramienta accesible que ahorre trabajo a profesionales independientes.

## 1. Estado y alcance reales

Lee AGENTS, MASTER_SWITCH, estado/read set, versión de ToS EN/ES, privacidad y recibos actuales. Registra rama/HEAD, dirty state, remoto, release alojado y diferencias entre ellos. No sobrescribas demos, MCP, agentes, renders o cambios de otro trabajo. No presentes un diálogo abierto como aceptación de términos ni un alias de correo como identidad de acceso.

Consulta el paquete central de ToS del 25 de octubre de 2026 y revalida fuentes oficiales vigentes para cada decisión. No inventes sociedad AEKR, equipo de moderación, proveedor, credenciales, publicación automática o admisión SIWC. Este discovery no modifica la publicación ni la exportación actuales.

## 2. Mapa completo de entradas y salidas

Traza Space —incluido material bruto o referencias—, perfiles/productos, importaciones y uploads, texto, imágenes, audio, vídeo, transcripción/OCR, miniaturas, metadatos, campañas, borradores, herramientas/MCP/agentes, renders, revisión y exportaciones. Identifica operaciones efectivas y rutas inexistentes. Distingue originales, derivados, vista previa, archivo exportado y publicación manual o integración futura en redes.

La prevención debe considerar texto de odio, amenazas, acoso/doxxing, incitación violenta, crueldad y maltrato animal, pornografía/desnudez, imágenes de menores prohibidas por la regla propia del producto, CSAM/grooming/sexualización abusiva, imágenes íntimas sin consentimiento y deepfakes abusivos, contenido robado/sin derechos, suplantación y estafas. Cubre componentes de una campaña y el resultado compuesto: un vídeo con fotogramas benignos puede incluir audio, subtítulos o enlaces abusivos.

Por orden expresa adicional, marKER no admite vídeos generados por IA ni AI slop en Space, campañas, renders ni exportaciones. Incluye generación o sustitución creativa por IA de escenas, personajes/avatares o voces del vídeo, sin un porcentaje mínimo inventado y aunque tenga alta calidad. AI slop comprende producción generativa automatizada masiva, repetitiva, engañosa o spam. La asistencia ordinaria de texto, subtítulos, recorte o plantillas sobre material real no constituye por sí sola generación audiovisual prohibida. Diseña la distinción con procedencia verificable, límites del análisis y revisión; la calidad estética, la falta de metadatos, un score o sospecha no prueban origen ni bastan para una sanción permanente. No prometas que un detector determina con certeza si un vídeo es de IA ni introduzcas una excepción por etiquetarlo como generado.

## 3. Derechos, contexto y decisión

Diseña evidencia mínima de derechos sobre imagen, música, voz, marcas y material de terceros sin exigir contratos privados o documentos de identidad de forma universal. Una casilla «tengo derechos» no constituye certificación; una coincidencia de hash tampoco prueba por sí sola infracción o licencia.

Distingue la regla estricta de producto de la ilegalidad penal. No conviertas una estimación de edad en una acusación de CSAM. Considera citas, denuncia crítica, lenguaje recuperado y diferencias culturales para odio/violencia, manteniendo el alcance de contenido elegido por AEKR. Define incertidumbre, falso positivo y revisión sin enseñar evasiones operativas.

## 4. Enforcement propuesto por artefacto y usuario

Localiza puntos de control en admisión, análisis, preparación, render, aprobación y último acceso a la exportación. La aprobación corresponde al artefacto/versiones exactos y se invalida ante cambios relevantes. No debe haber bypass por API, herramienta, render anterior, enlace directo o descarga regenerada. Identifica qué control sólo cliente es eludible y qué requeriría enforcement servidor. Un archivo ya descargado o publicado manualmente fuera del servicio puede quedar fuera del control técnico de marKER; no prometas revocarlo, borrarlo de dispositivos ajenos o impedir su difusión externa.

Propón estados tipados y reversibles: admitido, corrección, revisión, cuarentena/restricción de operación, suspensión provisional pendiente de revisión y decisión definitiva motivada. Define cómo cancelar colas, trabajos en curso y enlaces de salida; cómo aplicar revocación a concurrencia, reintentos, idempotencia y recuperación. No confundas cuarentena de un material con suspensión total de la persona. Un LLM, palabra o score aislado no decide una sanción permanente.

## 5. Operación, privacidad y garantías

Diseña aviso, explicación, revisión humana efectiva, apelación por `marker@aekr.io` u otro canal real aprobado, corrección y restablecimiento, sin inventar SLA o personal. Mantén derechos de datos, exportación lícita y tratamiento de registros necesarios. Una apelación no debe exigir volver a subir material presuntamente ilegal.

Determina necesidad, alcance, fundamentos, proveedores/regiones, acceso y retención de cualquier nueva inspección de texto, voz o imagen. No introduzcas reconocimiento facial, biometría o perfilado sensible como solución por defecto. No descargues, generes o reenvíes contenido de víctimas/CSAM a proveedores, revisores o repositorios. La eventual preservación/reporte obligatorio necesita un protocolo separado según rol y jurisdicción; no prometas borrado inmediato universal ni vigilancia general permanente.

## 6. Herramientas, coste y evaluación segura

Compara controles deterministas, análisis de texto/audio/fotogramas y proveedores multimodales con sus límites reales: muestreo puede omitir escenas, OCR/transcripción puede fallar y análisis parcial no acredita seguridad del vídeo entero. Evalúa alternativa local, acceso/admisión de proveedores, retención, regiones, propiedad de material, CPU/almacenamiento, cuotas de vídeo, concurrencia, tamaño/duración y presupuesto para mantener accesibilidad económica.

Usa fixtures sintéticos benignos y etiquetas simuladas para diseñar pruebas de categorías, idiomas, transformaciones, deriva, falsos positivos, timeouts, trabajos parciales y apelación/reversión. No generes ni descargues material ilícito para probar. Propón métricas, criterios de revisión y una fase de observación controlada antes del bloqueo, sin inventar umbrales aprobados ni certificar precisión.

## Entregables

Entrega mapa de flujo con puntos de enforcement, gap analysis frente a los ToS, ADR con alternativas/costes, contratos de decisión por artefacto/usuario/versiones, proceso humano, análisis jurídico condicionado, plan de evaluación y backlog por etapas. Incluye un prompt posterior de implementación con alcance, permisos, datos y decisiones aún pendientes. Marca claramente hecho, propuesta y desconocido. **No implementes, no despliegues, no suspendas usuarios y no publiques contenido en este discovery.**
