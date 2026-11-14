# Documentación de Pull It Together

Pull It Together es un juego de trivia multijugador en tiempo real. Dos equipos responden preguntas y cada acierto jala una cuerda digital hasta dejar al rival al borde del knockout. Pull It Together esta hecho totalmente desde 0 sin un framework nativo (Vanilla JS). La sincronización entre la pantalla del anfitrión y los móviles usa Supabase (Realtime por canales y una tabla rooms como respaldo para las salas).

---

## 1. ¿Cómoejecutarlo?

- **Desarrollo local:** `pwsh -File tools/serve.ps1` levanta un servidor en `http://localhost:5173/`.
- **Producción:** al ser estático, funciona en GitHub Pages o cualquier hosting de archivos. `index.html` carga `src/main.js` como módulo.
- **Sin dependencias locales:** la única librería externa es `@supabase/supabase-js`, importada por URL desde jsDelivr en `src/net/supabase.js`.

---

## 2. Archivos y Funcionamiento

| Archivo | Función |
| --- | --- |
| `index.html` | Documento único de la aplicación. Define metadatos sociales y SEO, precarga las fuentes, carga en orden las 20 hojas de estilo y monta `#app` y `#toasts`. Es el punto de entrada real del sitio. |
| `README.md` | Presentación pública del proyecto: de qué trata, características, stack y créditos. |
| `CREDITS.md` | Atribución del arte, la música y los efectos a los creadores de los assets. |
| `LICENSE` | Licencia del proyecto (MIT / CC0 según el contenido). |
| `docs.md` | Mapa técnico y de conexiones. |
| `tools/serve.ps1` | Servidor HTTP estático en PowerShell para Windows. Sirve archivos con el MIME correcto, bloquea rutas fuera de la raíz y desactiva caché. |
| `.github/workflows/keep-alive.yml` | GitHub Action que hace pings periódicos a Supabase para que el proyecto gratuito no se suspenda por inactividad. |
| `src/validation/google92aba8c73c4f098d.html` | Archivo de verificación de Google Search Console. No participa en la app. |

---

## 3. Rutas y Arranque

### `src/main.js`
Es el enrutador. Escucha `hashchange`, resuelve la ruta y llama a la pantalla correspondiente dentro de `#app`.

| Ruta | Pantalla |
| --- | --- |
| `#/` | Inicio (`renderHome`) |
| `#/join` | Unirse con código (`renderJoin`) |
| `#/room/:code` | Unirse a una sala concreta (`renderJoin` con código) |
| `#/stage/:code` | Pantalla del anfitrión / sala (`renderStage`) |
| `#/play/:code` | Pantalla del jugador (`renderPlay`) |
| `#/admin` | Banco de preguntas (`renderAdmin`) |

Además cambia el `document.title`, limpia la pantalla anterior ejecutando el `cleanup` que devuelve cada vista y hace scroll al inicio en cada navegación. Esto es clave: las vistas que abren intervalos, canales o escenas deben devolver una función de limpieza.

---

## 4. Núcleo (`src/core`)

### `src/core/utils.js`
Caja de herramientas compartida. Incluye selectores (`$`, `$$`), creación de nodos (`el`), escape de HTML (`esc`), utilidades numéricas (`clamp`, `rnd`, `pick`, `shuffle`), normalización de texto (sin acentos, útil para buscar y comparar), fechas/tiempos (`fmtClock`, `fmtMs`), avatares (`avatarSrc`), IDs (`uid`), código de sala (`roomCode`), lectura/escritura segura de `localStorage` (`readJSON`, `writeJSON`, `removeKey`), portapapeles (`copyText`) y descargas (`downloadFile`). Prácticamente todos los módulos dependen de él.

### `src/core/audio.js`
Gestiona música y efectos. Mantiene el estado de silencio en `localStorage` (`tyg.muted`), reproduce SFX por nombre (`select`, `correct`, `wrong`, `pull`, `win`, `tick`), arranca/para la música de fondo y desbloquea el audio en el primer gesto del usuario (requisito de los navegadores). Lo usan el inicio, el lobby, la partida y las pantallas de jugador.

### `src/core/rules.js`
Corazón matemático del juego. Define la puntuación (`SCORE`), calcula la opción mayoritaria con desempate por velocidad (`majorityChoice`), arma los puntos individuales, aplica bonus por racha y aciertos, convierte la diferencia de puntos en posición de cuerda (`ropeFromScores`), detecta knockout (`isKnockout`), ordena jugadores (`rankPlayers`) y decide el ganador (`resolveWinner`). Lo consume `HostRoom` al revelar cada ronda y las pantallas de resultados.

### `src/core/client.js`
Cliente del jugador (`PlayerClient`). Se conecta al canal de la sala, envía `join`, escucha snapshots del anfitrión, corrige el reloj con el desfase del servidor (`serverNow`), vota, hace ping cada 15 s, detecta desconexiones, reintenta el `join` si el jugador desaparece del estado y avisa de expulsiones. Lo usa `src/ui/screens/play/index.js`.

### `src/core/host.js`
Archivo barril (re-exporta) del host. Mantiene las importaciones antiguas funcionando:

```js
export { HostRoom } from './host/room.js';
export { createState } from './host/state.js';
export { MAX_PLAYERS, MIN_PLAYERS, PHASE_MS } from './host/constants.js';
```

### `src/core/host/constants.js`
Constantes del host: máximo 30 jugadores, mínimo 2, 15 por equipo, duraciones de fase (`countdown` 3 s, `reveal` 7 s, cierre por "todos votaron" 0.9 s), lista de nombres de bots, avatares disponibles y la clave de `localStorage` para datos privados del host.

### `src/core/host/state.js`
Fábrica del estado inicial de una sala (`createState`) y de un jugador (`createPlayer`). El estado contiene código, revisión, fase, configuración (rondas, duración, dificultad, categorías), equipos, cuerda, ronda, pregunta pública, votos, jugadores, resultado, ganador e historial. Es el contrato que comparten host, jugadores y UI.

### `src/core/host/storage.js`
Persistencia local de los datos privados del host (cola de preguntas, índice correcto, votos y duración) bajo `tyg:hostdata:CODE`. Así una recarga del anfitrión no pierde la partida en curso.

### `src/core/host/messages.js`
Procesa los mensajes que llegan al host: `hello` (reenviar estado), `join` (validar apodo, cupo, equipos y expulsiones), `vote` (registrar voto con tiempo), `ping` (mantener vivo al jugador) y `leave` (marcar desconectado). También contiene `castVote`, reutilizado por los bots. Lo llama `HostRoom.onMessage`.

### `src/core/host/room.js`
La clase `HostRoom`, el cerebro de la partida. Crea el estado, abre el canal, arranca el reloj interno (250 ms), gestiona fases (lobby → countdown → question → reveal → results), configuración, equipos, bots, votos, revelado, knockout, revancha, publicación de snapshots y limpieza. Se conecta con `net/bus`, `questions`, `rules`, `state`, `messages`, `storage` y `constants`.

---

## 5. Banco de preguntas (`src/core/questions`)

`src/core/questions.js` es el barril del módulo y concentra las exportaciones que usan la UI y el host.

| Archivo | Qué hace |
| --- | --- |
| `questions/config.js` | Claves de `localStorage` (`tyg.questions.v1`, `.meta`, `.seen`), lista de dificultades y sus etiquetas, letras de opciones y límites de validación. |
| `questions/bank.js` | Carga el banco desde `localStorage` o lo siembra desde los datos iniciales; guarda, restaura y cuenta. `categoriesOf` obtiene las categorías únicas ordenadas en español; `difficultyOf`, `searchBank` y `bankStats` alimentan filtros y contadores del panel. |
| `questions/queue.js` | `buildQueue` filtra por categoría/dificultad, elimina duplicados y preguntas inválidas, prioriza las no vistas y arma la cola de la partida; `toPublic` recorta la pregunta para enviarla a los jugadores (sin la respuesta correcta). |
| `questions/validation.js` | Valida una pregunta del editor: longitudes, mínimo/máximo de opciones, opciones vacías o repetidas, respuesta correcta válida y texto duplicado. Devuelve `{ ok, errors, data }` con ID nuevo o conservado. |
| `questions/import-export.js` | Convierte el formato Markdown de la plantilla en preguntas (`parseImport`) y genera la plantilla o la exportación del banco (`buildTemplate`). Tolera “Opción A”, “A)”, “Correcta: B”, etc. |

Flujo: el panel de admin lee y escribe el banco; el lobby del host pide categorías y el host construye la cola al empezar; el editor y el importador validan antes de persistir.

---

## 6. Datos iniciales (`src/data`)

`src/data/seed-questions.js` importa 11 listas y las concatena en `SEED_QUESTIONS`, con `SEED_VERSION` para controlar la siembra. Cada archivo de `src/data/questions/` contiene las preguntas de una categoría, con el mismo formato:

```js
{ id, text, options: ['A', 'B', 'C', 'D'], correct: 0, category: 'Ciencia', difficulty: 'easy' }
```

Archivos: `ciencia.js`, `geografia.js`, `historia.js`, `naturaleza.js`, `arte.js`, `literatura.js`, `cine.js`, `musica.js`, `deportes.js`, `tecnologia.js` y `cultura.js`. En total, 100 preguntas. El orden del arreglo define el orden inicial del banco. Para añadir preguntas de fábrica, se edita el archivo de su categoría.

---

## 7. Red (`src/net`)

### `src/net/supabase.js`
Crea el cliente de Supabase con la URL y la clave publicable. Es la única dependencia externa y lo importa `bus.js`.

### `src/net/bus.js`
Capa de transporte y salas. Expone:

- `Channel`: canal Realtime con cola de mensajes, espera de conexión, reintentos y cierre seguro.
- Snapshots: `saveSnapshot`, `loadSnapshot`, `fetchSnapshot` (local + tabla `rooms` de Supabase, con escritura limitada a una cada 2.5 s).
- Identidad del jugador por sala: `saveMe`, `loadMe`, `clearMe`.
- Presencia del host: `touchHost`, `hostAlive`, `roomExists`.

Lo usan `HostRoom` (publica estado), `PlayerClient` (escucha y vota), la pantalla de unión (comprueba sala) y el inicio (crea código). Las claves locales son `tyg:room:CODE`, `tyg:me:CODE` y `tyg:host:CODE`.

---

## 8. Escena gráfica (`src/game`)

`src/game/scene.js` es el barril de la escena.

| Archivo | Qué hace |
| --- | --- |
| `scene/markup.js` | Genera el HTML del escenario (cielo, nebulosas, estrellas, planeta, luna, satélite, rocas, cordilleras, cristales, suelo, VS, equipos y cuerda) y el HTML de cada personaje con sus sprites de idle, caminar y golpe. |
| `scene/effects.js` | Animación del tirón: clases de sacudida, etiqueta con el delta y chispas. |
| `scene/index.js` | `createScene`: monta el escenario, reparte jugadores por equipo (en dos filas si hay más de 9), calcula tamaños y solapamientos según el ancho, actualiza la posición de la cuerda, marca votantes y aciertos, reproduce el efecto de tirón y limpia intervalos y listeners. |
| `scene/home.js` | `decorateHomeScene`: crea una escena de demostración con 8 personajes y una cuerda que oscila, usada como fondo animado del inicio. |

La escena se usa en el inicio, el lobby del anfitrión y la partida. No conoce las reglas: recibe el estado y solo lo representa.

---

## 9. Componentes de UI (`src/ui`)

| Archivo | Qué hace |
| --- | --- |
| `ui/modal.js` | `openModal`: crea un fondo modal, bloquea el scroll del body, cierra con Escape, con el fondo o con `[data-close]/[data-cancel]`. Lo usan editor, importación, borrado múltiple y ayuda. |
| `ui/toast.js` | `toast`: añade avisos temporales al contenedor `#toasts`, con variantes `ok` y `bad`, y limita a 3 visibles. Lo usan casi todas las pantallas. |

---

## 10. Pantallas (`src/ui/screens`)

### Inicio — `home.js`
Renderiza el hero (título, texto, botones, notas), las tres tarjetas de “cómo se juega” y el pie con créditos. Usa `decorateHomeScene` para el fondo, crea el código de sala al pulsar “Crear sala” y alterna el sonido. Su `cleanup` destruye la escena.

### Unirse — `join.js`
Formulario de entrada: código de sala, apodo, avatar y equipo, con validación y recordatorio del apodo. Comprueba si la sala existe (`fetchSnapshot`), reutiliza la identidad guardada (`loadMe`) y redirige a `#/play/CODE`. Guarda el jugador con `saveMe`.

### Jugador — `play.js` + `play/`
`play.js` es el barril; la lógica real está en `play/index.js`.

| Archivo | Qué hace |
| --- | --- |
| `play/index.js` | Monta la cabecera del jugador, crea `PlayerClient`, conecta, gestiona estado, conexión, errores y expulsión, y decide qué subvista mostrar según la fase. También controla el temporizador y la limpieza. |
| `play/wait.js` | Sala de espera del jugador y cuenta atrás de inicio. |
| `play/question.js` | Pregunta con temporizador, barra, categoría y botones de respuesta. Permite cambiar el voto y refleja cuántos han votado. |
| `play/reveal.js` | Resultado personal: acierto/fallo, tiempo, puntos, lo que eligió el equipo y la respuesta correcta. |
| `play/results.js` | Resumen final con ranking del equipo, aciertos, puntos y racha. |

### Anfitrión — `stage.js` + `stage/`
`stage.js` es el barril; la lógica real está en `stage/index.js`.

| Archivo | Qué hace |
| --- | --- |
| `stage/index.js` | Crea `HostRoom`, arranca la sala, escucha cambios, alterna entre lobby y partida, muestra resultados, controla la música y devuelve la limpieza completa. |
| `stage/lobby.js` | Lobby: código e invitación, equipos y jugadores, mover/quitar, nombres de equipo, configuración de rondas/tiempo/dificultad/categorías, bots y botón de empezar. |
| `stage/game.js` | HUD de la partida: ronda, marcadores, reloj, barra de cuerda, escena, cuenta atrás, panel de pregunta con opciones, panel de revelado, saltos y avisos de KO. |
| `stage/results.js` | Pantalla final del anfitrión: ganador, marcadores, rankings con MVP, confeti y acciones de revancha/lobby/nueva sala. |
| `stage/shared.js` | Utilidades de la etapa: pantalla completa y confeti. |

### Admin — `admin.js` + `admin/`
`admin.js` es el barril; la lógica real está en `admin/panel.js`.

| Archivo | Qué hace |
| --- | --- |
| `admin/panel.js` | Panel del banco: listado con búsqueda y filtros por categoría/dificultad, estadísticas, crear/editar/duplicar/borrar, borrado múltiple, importar/exportar/plantilla, restaurar y ayuda. Persiste con `saveBank`. |
| `admin/editor.js` | Modal de creación/edición. La categoría es un `<select>` obligatorio construido con las categorías existentes, la del borrador y `General`; la dificultad también es un desplegable. Valida y guarda. |
| `admin/import.js` | Modal de importación: muestra cuántas preguntas son válidas/omitidas y permite añadir al banco o reemplazarlo, resolviendo IDs duplicados. |
| `admin/bulk-delete.js` | Modal de borrado múltiple sobre el resultado de los filtros actuales, con seleccionar todas/ninguna y confirmación. |
| `admin/help.js` | Modal de ayuda con formato Markdown, reglas de importación y consejos. |

---

## 11. Estilos (`src/styles`)

### Base
| Archivo | Qué hace |
| --- | --- |
| `tokens.css` | Fuentes locales (`@font-face`) y variables de diseño: colores, equipos, tipografías, sombras, radios, espaciados, transiciones y capas. Todo lo demás consume estas variables. |
| `base.css` | Reset, tipografía base, fondo, botones, paneles, formularios, chips, divisores, toasts, modales, animaciones, scrollbars y preferencias de movimiento reducido. |

### Pantallas
| Archivo | Qué hace |
| --- | --- |
| `screens/topbar.css` | Barra superior de marca y navegación. |
| `screens/home.css` | Hero del inicio, escena, tarjetas y pie. Incluye el espaciado responsable del hero y la recolocación móvil del planeta/luna. |
| `screens/arena-background.css` | Cielo, nebulosas, estrellas, planeta, luna, satélite, rocas, cordilleras, cristales, suelo y emblema VS. |
| `screens/arena-characters.css` | Personajes, animaciones de caminar/tirar, espejo del equipo rival y ventaja de equipo. |
| `screens/arena-rope.css` | Cuerda de dos colores, pin central y divisores. |
| `screens/hud.css` | Cabecera de la partida: ronda, equipos, reloj y herramientas. |
| `screens/tug.css` | Barra de fuerza, nave/OVNI y estados de ventaja, empate y KO. |
| `screens/question-panel.css` | Panel de pregunta del anfitrión y sus opciones. |
| `screens/stage-overlays.css` | Cuenta atrás, banner de ronda, insignias de revelado y capas superpuestas. |
| `screens/lobby.css` | Lobby: invitación, equipos, configuración y escena inferior. |
| `screens/results.css` | Resultados del anfitrión y tableros por equipo. |
| `screens/player-shell.css` | Estructura general del móvil del jugador. |
| `screens/player-question.css` | Pregunta y respuestas en móvil. |
| `screens/player-reveal.css` | Tarjeta de revelado en móvil. |
| `screens/player-results.css` | Resultados personales en móvil. |
| `screens/join.css` | Formulario de unión y selección de equipo. |
| `screens/admin.css` | Panel de preguntas, listado, editor y puerta de acceso. |
| `screens/responsive.css` | Ajustes por ancho y altura: portátiles bajos, tablets y móviles. Aquí viven las reglas que evitan saltos de scroll y recolocan el hero. |

El orden de carga en `index.html` importa: `tokens.css` y `base.css` primero, luego las pantallas y al final `responsive.css` para que sus reglas ganen cuando corresponda.

---

## 12. Flujos principales

### Crear y jugar una partida
1. `home.js` genera un código y navega a `#/stage/CODE`.
2. `stage/index.js` crea `HostRoom`, que publica el estado en Supabase y en `localStorage`.
3. Los jugadores entran por `#/room/CODE` (`join.js`), guardan su identidad y pasan a `#/play/CODE`.
4. `PlayerClient` envía `join`; el host valida y responde con el estado.
5. Al empezar, el host arma la cola con `buildQueue`, alterna fases y recibe votos.
6. En `reveal`, `rules.js` calcula puntos y cuerda; ambos lados actualizan UI y escena.
7. Al terminar, se muestran resultados y se ofrece revancha o vuelta al lobby.

### Editar el banco
1. `admin/panel.js` carga el banco con `loadBank`.
2. “Nueva pregunta” o “Editar” abre `admin/editor.js`; la categoría se elige de un desplegable.
3. `validateQuestion` valida y `persist` guarda con `saveBank`.
4. Importar usa `parseImport`, muestra el resumen en `admin/import.js` y persiste; exportar usa `buildTemplate`.

### Persistencia local
- `tyg.questions.v1`: banco de preguntas.
- `tyg.questions.meta` y `tyg.questions.seen`: metadatos de siembra y preguntas ya vistas.
- `tyg:room:CODE`: último snapshot de la sala.
- `tyg:me:CODE`: identidad del jugador en esa sala.
- `tyg:host:CODE` y `tyg:hostdata:CODE`: latido y datos privados del anfitrión.
- `tyg.muted` y `tyg.nickname`: preferencias del usuario.