# Datos y atribución

El código de Timeout se distribuye bajo GPL-3.0-only. Los siguientes datos mantienen licencias independientes compatibles con uso comercial:

* **Vocabulario y definiciones ES/EN:** colaboradores de Wikcionario/Wiktionary, extraídos por Kaikki/Wiktextract, CC BY-SA 4.0. `words-es.json` y `words-en.json` identifican la extracción, fecha, URL, hash y filtros. Cada entrada conserva su grafía, que identifica su artículo y autores: `https://es.wiktionary.org/wiki/{palabra}` o `https://en.wiktionary.org/wiki/{word}`; el historial del artículo contiene sus contribuciones. Se seleccionaron glosas, eliminaron entradas inadecuadas y comprimieron los paquetes. Las selecciones de palabras comunes de Cinco letras son una adaptación de estos datos.
* **Preguntas inglesas:** Open Trivia DB, https://opentdb.com/, CC BY-SA 4.0. Se eliminaron opciones de respuesta incorrectas, decodificaron entidades HTML y agruparon categorías para permitir respuesta abierta. Véase `trivia.json`.
* **Preguntas españolas:** contenido original de Timeout (2026), CC BY-SA 4.0. Están en `src/games/trivia/spanish.ts`; son preguntas originales, no traducciones certificadas del corpus inglés.

Se conserva la atribución a las fuentes y se incluye `CC-BY-SA-4.0.txt`. Los paquetes derivados se comparten bajo la misma licencia. No se presenta ningún léxico como diccionario oficial de competición.

Stockfish 19 Lite Single WASM se conserva sin modificar bajo GPLv3; versión, archivos y hashes en `stockfish-manifest.json`. La integración de Timeout añade un adaptador de Web Worker para cargar el WASM incluido sin solicitudes de red. Cada archivo de entrega incluye las atribuciones y acompaña una entrega de fuente correspondiente, incluido el árbol de Stockfish y su red neuronal.

Las bibliotecas de ejecución y fuentes IBM Plex conservan sus licencias MIT, BSD-2-Clause, ISC o SIL OFL 1.1. Sus textos completos están en `THIRD-PARTY-NOTICES.txt`, con versiones en `dependencies.json`. Ningún recurso de juego se ha copiado de ROM, gráficos, música ni nombres comerciales originales.
