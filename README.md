# Timeout

Una colección de juegos para hacer una pausa. Interfaz en español e inglés, temas claro y oscuro, partidas guardadas en el dispositivo y dos formas de jugar sin conexión: web con caché offline y un HTML portable.

Timeout no necesita cuentas, servidor de partidas ni conexión durante el juego. El multijugador consiste en compartir un dispositivo; los juegos con información privada muestran una pantalla de relevo. El repositorio es privado y esta entrega no publica la web en un alojamiento.

## Jugar

- **Web:** sirve la carpeta `dist/` mediante HTTPS o en `localhost`. Espera al indicador «Disponible sin conexión» antes de desconectarte. La primera visita necesita descargar los recursos; posteriormente la caché permite volver a abrirla sin red. Instalarla como PWA es opcional.
- **Portable:** abre `dist-portable/index.html` directamente en un navegador. Es un archivo autocontenido de aproximadamente **22 MB**, con juegos, fuentes, diccionarios, workers y Stockfish. Puedes trasladarlo sin instalar la aplicación ni arrancar un servidor.
- **Guías:** cada juego incluye reglas y ejemplos visuales. El botón «Guía» permite abrir una práctica que no modifica la partida ni las estadísticas. Solitarios y Cruce de letras también incluyen ejercicios interactivos específicos dentro de su guía del tablero.

En un móvil, algunos tableros se desplazan horizontalmente para conservar casillas y cartas legibles. Los controles del juego explican el teclado y las acciones táctiles disponibles. La compatibilidad comprobada y los resultados de las pruebas se documentan en [docs/verification.md](docs/verification.md).

## Colección

| Juego | Modalidades y características |
| --- | --- |
| Solitarios | Klondike de una o tres cartas; Spider de uno, dos o cuatro palos; FreeCell; Pirámide. Deshacer y pistas. |
| Ronda de letras | Rosco de definiciones en español o inglés, pasar palabra y tiempo configurable. |
| Crucigramas | Cuadrículas conectadas de 9×9, 11×11 y 13×13 con pistas horizontales y verticales; ayudas y nuevas partidas generadas. |
| Cruce de letras | Tablero 15×15, léxicos y fichas ES/EN, 2–4 participantes humanos o bots, comodines, cruces y desglose de puntuación. |
| Ajedrez | Dos personas o Stockfish con dificultad configurable; promoción, enroque, captura al paso y tablas. |
| Póker | Texas Hold’em sin límite, 2–6 participantes, humanos o bots, fichas ficticias y botes secundarios. |
| Dominó | Doble seis individual con robo o parejas; humanos y bots. |
| Carrera de pulso | Saltos, obstáculos y velocidad progresiva. |
| Vuelo de pulso | Vuelo entre obstáculos con controles de teclado o táctiles. |
| Sudoku | Nuevas partidas con solución única, cuatro dificultades, notas y ayudas. |
| Cinco letras | Palabras de cinco letras, seis intentos y tratamiento individual de letras repetidas. |
| Caída de bloques | Contrarreloj, objetivo de líneas o infinito; perfiles moderno SRS y clásico NES NTSC. |
| Billar | Bola 8 con tiro anunciado, dos personas o bot; práctica individual y simulación 2D. |
| Órbita del saber | Tablero de seis categorías, objetivos coleccionables, humanos o bots; respuestas abiertas y autoevaluación tras revelar la solución. |
| Serpiente | Comida, crecimiento, velocidad configurable y puntuaciones. |
| Rompebloques | Pala, rebotes, ladrillos, niveles y vidas. |

Las partidas de palabras eligen su idioma al comenzar, independientemente del idioma de la interfaz. Cuando no coinciden, la aplicación muestra un aviso y permite seguir jugando.

## Guardados y transferencia

Las acciones importantes se guardan automáticamente. Los juegos en tiempo real también se guardan periódicamente y al pausar. Al reabrir una partida, comienza en pausa. «Continuar» reúne las partidas pendientes; «Estadísticas» muestra resultados, tiempos y mejores puntuaciones por juego y variante.

El almacenamiento principal es **IndexedDB**. Si no está disponible se intenta `localStorage`; si tampoco puede escribir, la aplicación avisa de que solo conserva datos en memoria. Los guardados pertenecen al navegador y al origen de la página. En `file://`, su persistencia y relación con la ruta del HTML dependen del navegador: mover el archivo, cambiar de navegador, usar navegación privada o borrar los datos del sitio puede separar o eliminar los guardados.

Para trasladarlos, abre **Ajustes → Exportar todos los datos**. En el otro dispositivo, usa **Importar copia**: verás partidas pendientes, resultados y conflictos antes de confirmar. Puedes combinar sin duplicar identificadores, elegir qué versión conservar en los conflictos o reemplazar el conjunto. Se guarda una copia previa a la importación, recuperable desde «Recuperar copia anterior». El mismo JSON funciona en la web y en la edición portable.

## Desarrollo

Requisitos: **Node.js 22.12 o posterior** y npm. El entorno de desarrollo utilizado tiene Node.js 22.19. El lockfile fija las dependencias de esta versión.

```sh
npm ci
npm run dev
```

Vite muestra la dirección local del servidor de desarrollo. Para comprobar y compilar:

```sh
npm run check
npm test
npm run build
```

`build` comprueba TypeScript y genera `dist/` y `dist-portable/`. También existen `build:web` y `build:portable` para generar cada formato por separado.

Las pruebas de navegador usan Playwright. Descarga sus navegadores una vez y sirve primero la compilación web; en otra terminal, ejecuta las pruebas:

```sh
npx playwright install chromium firefox webkit
npx vite preview --host 127.0.0.1 --port 4173
```

```sh
npm run test:e2e
```

Los paquetes de palabras y preguntas están incluidos; jugar y compilar no requieren consultar sus servicios de origen. Los scripts `npm run data:words` y `npm run data:trivia` regeneran contenido mediante descargas y actualizan sus manifiestos de procedencia. Estas tareas requieren red y pueden descargar archivos grandes. `scripts/vendor-stockfish.mjs` documenta la obtención de los recursos del motor de ajedrez.

## Arquitectura y ampliación

React, TypeScript y Vite forman la interfaz y las compilaciones. Los motores de reglas conservan estados serializables y reciben acciones mediante reducers; DOM/SVG presenta tableros y Canvas 2D presenta los juegos de acción y billar. Las búsquedas y generaciones costosas utilizan Web Workers. Los recursos necesarios se distribuyen localmente.

- [Añadir un juego](docs/adding-games.md): contrato, registro, estado, guardados, bots, idiomas y guías.
- [Añadir un tema](docs/adding-themes.md): registro de temas, variables CSS, tableros y Canvas.
- [Verificación y compatibilidad](docs/verification.md): alcance real de las pruebas de esta entrega.

## Reglas y límites de esta versión

- «Infinito» permite generar nuevas sesiones sin un límite de la aplicación. Los corpus son finitos; las palabras y preguntas pueden repetirse.
- Los léxicos proceden de Wikcionario/Wiktionary. Pueden incluir formas flexionadas y términos regionales, técnicos o antiguos. **No son diccionarios oficiales de competición.** En Cruce de letras, los bots usan hasta 120 000 entradas con definición y priorizan las cortas para limitar memoria; la validación humana utiliza el léxico completo.
- En español se ignoran tildes al introducir respuestas y se mantiene la distinción entre N y Ñ. Cruce de letras usa CH, LL y RR como fichas indivisibles, cada una ocupa una casilla.
- Pirámide utiliza una sola vuelta del mazo; Klondike permite reciclarlo sin límite. La guía de cada variante especifica sus reglas.
- El perfil clásico de bloques reproduce las mecánicas documentadas de NES NTSC: rotación, gravedad, repetición lateral, azar y puntuación. Es una implementación independiente, no un emulador de ROM; no pretende reproducir todos los errores, desbordamientos ni detalles de hardware originales. El perfil moderno incluye SRS, bolsa de siete, reserva y sombra.
- El billar simula colisiones, bandas y rozamiento en dos dimensiones. No ofrece efectos de giro, saltos ni simulación tridimensional.
- En las preguntas abiertas, el participante decide si su respuesta coincide suficientemente con la solución revelada. Los bots usan una probabilidad de acierto configurable.
- No hay sincronización en nube ni multijugador por red. El HTML portable se orienta principalmente a escritorio; en móviles, la web con caché es la vía principal sin conexión.

## Licencias y fuentes

El código de Timeout se distribuye bajo **GPL-3.0-only**, según [LICENSE](LICENSE). Stockfish mantiene GPLv3; los manifiestos de `licenses/` identifican su versión, fuentes y hashes. Las entregas deben acompañar las compilaciones con el código fuente correspondiente y las licencias de todos los recursos redistribuidos.

Los datos mantienen sus licencias independientes:

- **Palabras y definiciones:** colaboradores de [Wikcionario](https://es.wiktionary.org/) y [Wiktionary](https://en.wiktionary.org/), extraídos por [Kaikki/Wiktextract](https://kaikki.org/), filtrados y compactados; CC BY-SA 4.0. Cada término conserva atribución al artículo del mismo nombre. Los manifiestos `licenses/words-es.json` y `licenses/words-en.json` registran procedencia y transformaciones.
- **Preguntas inglesas:** [Open Trivia DB](https://opentdb.com/), adaptadas a respuestas abiertas y almacenadas localmente; CC BY-SA 4.0. `licenses/trivia.json` registra su procedencia.
- **Preguntas españolas:** contenido original de Timeout, publicado como parte del paquete de preguntas bajo CC BY-SA 4.0.
- **Fuentes:** IBM Plex Sans y Mono, incluidas mediante `@fontsource`, conservan SIL Open Font License.

Los recursos visuales del juego se dibujan con código propio. Los nombres y gráficos de los títulos comerciales que inspiran ciertas mecánicas no forman parte de la distribución.
