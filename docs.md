Pull It Together - Documentación
================================

Pull It Together es un juego de trivia multijugador en tiempo real. Dos equipos
responden las mismas preguntas y cada acierto jala una cuerda digital hacia su lado,
hasta dejar al rival al borde del knockout.

Está hecho desde cero con JavaScript puro, sin frameworks. El anfitrión muestra el juego
en una pantalla grande y los jugadores participan desde su móvil. Para sincronizarlos se
usa Supabase: canales en tiempo real y una tabla llamada rooms que sirve de respaldo de
cada sala.

--------------------------------
1. Cómo ejecutarlo
--------------------------------

- Desarrollo local: ejecuta  pwsh -File tools/serve.ps1  y abre http://localhost:5173/
- Producción: es un sitio estático, así que funciona en GitHub Pages o en cualquier
  hosting de archivos. index.html carga src/main.js como módulo.
- No hay nada que instalar ni compilar.

Nota: el port 5173 puede ser cualquiera que tengas libre y disponible en tu maquina.

-------------------------------
2. Servicios externos
-------------------------------

El juego depende de estos servicios. Ninguno requiere servidor propio.

- Supabase: tiempo real y respaldo de las salas. Su cliente se importa por URL desde
  jsDelivr en src/net/supabase.js. Es la única librería externa.
- Web3Forms: recibe el formulario de reportes y lo envía al correo del autor. La access key está en src/ui/report.js; este servicio está pensado para que la key viaje en el cliente.
- Ko-fi: el botón Donar del inicio es solo un enlace a la página de Ko-fi del autor.
- GitHub Actions: un workflow hace pings periódicos a Supabase para que el proyecto
  gratuito no se pause por inactividad.

------------------------------
3. Archivos de la raíz
------------------------------

- index.html: el único documento de la aplicación. Define los metadatos sociales y de
  SEO, precarga las fuentes, carga en orden las hojas de estilo y monta los contenedores
  #app y #toasts. Es el punto de entrada real del sitio.
- README.md: presentación pública del proyecto: de qué trata, características,
  tecnologías y créditos.
- CREDITS.md: atribución del arte, la música y los efectos a sus creadores.
- LICENSE: licencia del proyecto (MIT / CC0 según el contenido).
- docs.md: este documento.
- tools/serve.ps1: servidor HTTP estático en PowerShell para Windows. Sirve los archivos
  con el tipo MIME correcto, bloquea rutas fuera de la raíz y desactiva la caché.
- .github/workflows/keep-alive.yml: la GitHub Action que mantiene vivo el proyecto de
  Supabase.
- src/validation/google92aba8c73c4f098d.html: archivo de verificación de Google Search
  Console. No participa en la app.

---------------------------
4. Rutas y arranque
---------------------------

# src/main.js 

es el enrutador. Escucha el cambio del hash de la URL, decide qué pantalla
toca y la dibuja dentro de #app. Las rutas son estas:

- #/  ->  Inicio
- #/join  ->  Unirse con un código
- #/room/CODIGO  ->  Unirse a una sala concreta
- #/stage/CODIGO  ->  Pantalla del anfitrión (la sala y la partida)
- #/play/CODIGO  ->  Pantalla del jugador en su móvil
- #/admin  ->  Banco de preguntas

Además, el enrutador cambia el título de la pestaña, limpia la pantalla anterior y sube
el scroll al inicio en cada navegación. Importante: toda pantalla que abra intervalos,
canales o escenas debe devolver una función de limpieza, porque el enrutador la ejecuta
al salir.

------------------------
5. Núcleo (src/core)
------------------------

- utils.js: caja de herramientas compartida: selectores, creación de nodos, escape de
  HTML, utilidades numéricas y de azar, normalización de texto (sin acentos, útil para
  buscar), formato de tiempos, avatares, IDs, código de sala, lectura y escritura segura
  de localStorage, portapapeles y descargas. Casi todos los módulos dependen de él.
- audio.js: música y efectos. Guarda si el sonido está silenciado, reproduce efectos por
  nombre (select, correct, wrong, pull, win, tick) y desbloquea el audio con el primer
  gesto del usuario, como exigen los navegadores. La música de fondo tiene tres
  operaciones: startMusic la inicia (o la sube de nuevo con fade si ya sonaba),
  duckMusic baja el volumen con fade sin detenerla, y stopMusic la detiene, con fade
  opcional.
- rules.js: el corazón matemático del juego. Define la puntuación, calcula la opción
  mayoritaria del equipo (con desempate por velocidad), arma los puntos individuales,
  aplica los bonus por racha y por aciertos, convierte la diferencia de puntos en
  posición de cuerda, detecta el knockout, ordena a los jugadores y decide el ganador.
  Lo usa HostRoom al revelar cada ronda y las pantallas de resultados.
- client.js: el cliente del jugador (PlayerClient). Se conecta al canal de la sala,
  envía el join, escucha los estados que manda el anfitrión, corrige el reloj con el
  desfase del servidor, vota, hace ping cada 15 segundos, detecta desconexiones,
  reintenta el join si el jugador desaparece del estado y avisa si lo expulsan.
- host.js: archivo que solo re-exporta las piezas del host (HostRoom, createState y las
  constantes) para que las importaciones antiguas sigan funcionando.

# SRC/CORE/HOST

- constants.js: máximo de 30 jugadores, mínimo de 2, 15 por equipo, duración de cada
  fase (cuenta atrás 3 s, revelado 7 s, cierre anticipado de 0.9 s cuando todos ya
  votaron), nombres de los bots, avatares disponibles y la clave de localStorage de los
  datos privados del host.
- state.js: fábrica del estado inicial de una sala y de un jugador. El estado guarda el
  código, la revisión, la fase, la configuración (rondas, duración, dificultad,
  categorías), los equipos, la cuerda, la ronda, la pregunta pública, los votos, los
  jugadores, el último resultado, el ganador y el historial. Es el contrato que
  comparten host, jugadores y pantallas.
- storage.js: guarda localmente los datos privados del host (cola de preguntas, índice
  de la respuesta correcta, votos y duración). Así, si el anfitrión recarga la página,
  no pierde la partida en curso.
- messages.js: procesa los mensajes que le llegan al host: hello (reenviar el estado),
  join (validar apodo, cupo, equipos y expulsiones), vote (registrar el voto con su
  tiempo), ping (mantener vivo al jugador) y leave (marcarlo como desconectado). También
  contiene castVote, que reutilizan los bots.
- room.js: la clase HostRoom, el cerebro de la partida. Crea el estado, abre el canal,
  arranca el reloj interno (cada 250 ms) y controla las fases: lobby, cuenta atrás,
  pregunta, revelado y resultados. También maneja la configuración, los equipos, los
  bots, los votos, el knockout, la revancha, la publicación del estado y la limpieza al
  cerrar.

------------------------------------------
6. Banco de preguntas (src/core/questions)
------------------------------------------

# questions.js (en src/core) 

reúne las exportaciones que usan la interfaz y el host. El
trabajo real está repartido en estos archivos:

- config.js: claves de localStorage, lista de dificultades con sus etiquetas, letras de
  las opciones y límites de validación.
- bank.js: carga el banco desde localStorage o lo siembra desde los datos iniciales;
  guarda, restaura y cuenta. También obtiene las categorías únicas, la dificultad de
  cada pregunta, la búsqueda y las estadísticas del panel.
- queue.js: arma la cola de preguntas de la partida: filtra por categoría y dificultad,
  quita duplicados y preguntas inválidas, y prioriza las que el jugador no ha visto.
  También recorta la pregunta antes de enviarla a los jugadores, para que no incluya la
  respuesta correcta.
- validation.js: valida una pregunta del editor: longitudes, mínimo y máximo de
  opciones, opciones vacías o repetidas, respuesta correcta válida y texto duplicado.
- import-export.js: convierte el formato Markdown de la plantilla en preguntas y genera
  la plantilla o la exportación del banco.

El flujo es el siguiente: el panel de admin lee y escribe el banco, el lobby pide las
categorías, el host construye la cola al empezar, y tanto el editor como el importador
validan antes de guardar.

-----------------------------
7. Datos iniciales (src/data)
-----------------------------

# seed-questions.js 
Junta las listas de preguntas de fábrica y lleva un número de versión
para controlar cuándo se vuelve a sembrar el banco. Cada categoría vive en su propio
archivo dentro de src/data/questions: ciencia, geografía, historia, naturaleza, arte,
literatura, cine, música, deportes, tecnología y cultura. En total son 100 preguntas,
con este formato:

    { id, text, options: ['A', 'B', 'C', 'D'], correct: 0,
      category: 'Ciencia', difficulty: 'easy' }

El orden del arreglo define el orden inicial del banco. Para añadir preguntas de
fábrica, se edita el archivo de su categoría.

-----------------------
8. Red (src/net)
-----------------------

- supabase.js: crea el cliente de Supabase con la URL y la clave pública. Es la única
  dependencia externa y solo la importa bus.js.
- bus.js: la capa de transporte y de salas. Incluye el canal en tiempo real (con cola de
  mensajes, espera de conexión, reintentos y cierre seguro), los snapshots de la sala
  (guardados en local y en la tabla rooms, con un máximo de una escritura cada 2.5
  segundos), la identidad del jugador por sala y la presencia del host. Lo usan
  HostRoom, PlayerClient, la pantalla de unirse y el inicio.

----------------------------
9. Escenario (src/game)
----------------------------

# scene.js 
Reúne las exportaciones de la escena. La escena no conoce las reglas: recibe el
estado y solo lo dibuja. Se usa en el inicio, en el lobby y en la partida.

- scene/markup.js: genera el HTML del escenario (cielo, nebulosas, estrellas, planeta,
  luna, satélite, rocas, cordilleras, cristales, suelo, el VS, los equipos y la cuerda)
  y el de cada personaje con sus sprites.
- scene/effects.js: la animación del tirón: sacudida, etiqueta con el delta y chispas.
- scene/index.js: createScene monta el escenario, reparte a los jugadores por equipo (en
  dos filas si hay más de 9), calcula tamaños y solapes según el ancho, mueve la cuerda,
  marca quién votó y quién acertó, reproduce el tirón y limpia intervalos y listeners al
  salir.
- scene/home.js: escena de demostración con 8 personajes y una cuerda que oscila. Es el
  fondo animado del inicio.

-------------------------------------
10. Componentes de interfaz (src/ui)
-------------------------------------

- modal.js: openModal crea el fondo oscuro del modal, bloquea el scroll, y cierra con
  Escape, con un clic fuera o con los botones marcados con data-close o data-cancel. Lo
  usan el editor, la importación, el borrado múltiple, la ayuda y el formulario de
  reportes.
- toast.js: muestra avisos temporales en #toasts, con variantes ok y bad, y como máximo
  3 a la vez.
- report.js: el formulario para reportar problemas o enviar sugerencias. Pide tipo,
  mensaje y un correo opcional, lo envía a Web3Forms y al terminar muestra una pantalla
  de confirmación. Incluye un campo trampa anti-bots y una espera de 60 segundos entre
  envíos para no gastar el cupo mensual.

--------------------------------
11. Pantallas (src/ui/screens)
--------------------------------

# INICIO (HOME.JS)
Dibuja el hero con título, texto y botones, las tres tarjetas de cómo se juega y el pie
de página con créditos. La barra superior tiene el botón Donar (con un corazón animado
que lleva a Ko-fi), el acceso al banco de preguntas y el botón de sonido. En el pie hay
un enlace que abre el formulario de reportes y sugerencias. Usa la escena de
demostración como fondo, crea el código de sala al pulsar Crear sala y, al salir,
destruye la escena.

# UNIRSE (JOIN.JS)
Formulario con código de sala, apodo, avatar y equipo, con validación y recordatorio del
apodo. Comprueba si la sala existe, reutiliza la identidad guardada y redirige a la
pantalla del jugador.

# JUGADOR (PLAY.JS Y CARPETA PLAY/)
play.js solo re-exporta; la lógica está en play/index.js.

- play/index.js: arma la cabecera del jugador (equipo, apodo, contador de racha personal
  con una llama y punto de conexión), crea el PlayerClient, maneja el estado, la
  conexión, los errores y la expulsión, y decide qué subpantalla mostrar según la fase.
  También controla el temporizador y la limpieza.
- play/wait.js: sala de espera del jugador y cuenta atrás de inicio.
- play/question.js: la pregunta con su temporizador, barra, categoría y botones de
  respuesta. Permite cambiar el voto y muestra cuántos han votado.
- play/reveal.js: el resultado personal: si acertó o falló, en cuánto tiempo, cuántos
  puntos ganó, qué eligió el equipo y cuál era la respuesta correcta.
- play/feedback.js: el aviso flotante que aparece sobre la tarjeta del reveal con un
  mensaje según la racha personal: Genial, Excelente, Fantástico e Imparable, con el
  número de la racha desde dos aciertos. Si el jugador pierde una racha de dos o más,
  avisa con Racha perdida. Si falla o no vota, muestra un mensaje de ánimo.
- play/results.js: resumen final con el ranking del equipo, aciertos, puntos y racha.

# ANFITRIÓN (STAGE.JS Y CARPETA STAGE/)
stage.js solo re-exporta; la lógica está en stage/index.js.

- stage/index.js: crea el HostRoom, arranca la sala, escucha los cambios y alterna entre
  lobby, partida y resultados. También controla la música: sonando durante la partida,
  bajando poco a poco desde el último reveal, en volumen bajo en resultados, y
  apagándose con fade solo al volver al lobby o salir. Devuelve la limpieza completa.
- stage/lobby.js: el lobby: código e invitación, equipos y jugadores (mover o quitar),
  nombres de equipo, configuración de rondas, tiempo, dificultad y categorías, bots y el
  botón de empezar.
- stage/game.js: el HUD de la partida: ronda, marcadores, reloj, barra de fuerza,
  escena, cuenta atrás, panel de la pregunta con sus opciones, panel de revelado, saltos
  y aviso de KO. En el reveal muestra además el aviso de racha de cada equipo debajo del
  medidor de fuerza.
- stage/results.js: pantalla final del anfitrión: ganador, marcadores, rankings con MVP,
  confeti y las acciones de revancha, volver al lobby o nueva sala.
- stage/shared.js: utilidades de la pantalla del anfitrión: pantalla completa y confeti.

# ADMIN (ADMIN.JS Y CARPETA ADMIN/)
admin.js solo re-exporta; la lógica está en admin/panel.js.

- admin/panel.js: el panel del banco: lista con búsqueda y filtros por categoría y
  dificultad, estadísticas, crear, editar, duplicar y borrar, borrado múltiple,
  importar, exportar, plantilla, restaurar y ayuda. Guarda con saveBank.
- admin/editor.js: el modal de crear o editar una pregunta. La categoría y la dificultad
  son desplegables. Valida antes de guardar.
- admin/import.js: el modal de importación: muestra cuántas preguntas son válidas y
  cuántas se omiten, y permite añadirlas al banco o reemplazarlo, resolviendo IDs
  duplicados.
- admin/bulk-delete.js: el modal de borrado múltiple sobre el resultado de los filtros
  actuales, con seleccionar todas o ninguna y confirmación.
- admin/help.js: el modal de ayuda con el formato Markdown, las reglas de importación y
  consejos.


--------------------------------
12. Estilos (src/styles)
--------------------------------

El orden de carga en index.html importa: primero tokens.css y base.css, luego las
pantallas, y al final responsive.css para que sus reglas ganen cuando haga falta.

# BASE

- tokens.css: las fuentes locales y las variables de diseño: colores, equipos,
  tipografías, sombras, radios, espaciados, transiciones y capas. Todo lo demás las usa.
- base.css: reset, tipografía, fondo, botones, paneles, formularios, chips, divisores,
  toasts, modales, animaciones, scrollbars y soporte para movimiento reducido.

# PANTALLAS (SRC/STYLES/SCREENS)

- topbar.css: barra superior de marca y navegación.
- home.css: hero del inicio, escena, tarjetas, pie de página, botón Donar y enlace de
  reportes.
- arena-background.css: cielo, nebulosas, estrellas, planeta, luna, satélite, rocas,
  cordilleras, cristales, suelo y el emblema VS.
- arena-characters.css: personajes, animaciones de caminar y tirar, espejo del equipo
  rival y ventaja de equipo.
- arena-rope.css: la cuerda de dos colores, el pin central y los divisores.
- hud.css: cabecera de la partida: ronda, equipos, reloj y herramientas.
- tug.css: barra de fuerza, la nave y los estados de ventaja, empate y KO.
- question-panel.css: panel de pregunta del anfitrión y sus opciones.
- stage-overlays.css: cuenta atrás, banner de ronda, insignias de revelado y el aviso de
  racha por equipo.
- lobby.css: invitación, equipos, configuración y escena inferior del lobby.
- results.css: resultados del anfitrión y tableros por equipo.
- player-shell.css: estructura general del móvil del jugador, incluyendo el contador de
  racha y el aviso flotante del reveal.
- player-question.css: pregunta y respuestas en el móvil.
- player-reveal.css: tarjeta de revelado en el móvil.
- player-results.css: resultados personales en el móvil.
- join.css: formulario de unión y selección de equipo.
- admin.css: panel de preguntas, listado, editor y puerta de acceso.
- responsive.css: ajustes por ancho y alto de pantalla: portátiles bajos, tablets y
  móviles. Aquí viven las reglas que evitan saltos de scroll y recolocan el hero.

------------------------------------
13. Rachas y avisos
------------------------------------

Hay dos tipos de racha, y cada una se muestra en su lugar.

# Racha de equipo
  cuenta los aciertos seguidos de todo un equipo. Cuando un equipo
  acierta con dos o más seguidos, en la pantalla del anfitrión aparece un aviso bajo el
  medidor de fuerza con el nombre del equipo, la etiqueta (Racha, En racha, En llamas,
  Imparable) y el bono de puntos.

# Racha personal 
  cuenta los aciertos seguidos de cada jugador. Se ve en su móvil como
  una llama con un número junto al punto de conexión. La llama se apaga con 0, se
  enciende desde 1 y parpadea desde 3. Al revelar cada ronda también aparece el aviso
  flotante de play/feedback.js.

--------------------------------------
14. Flujos principales
--------------------------------------

# CREAR Y JUGAR UNA PARTIDA

- home.js genera un código y navega a #/stage/CODIGO.
- stage/index.js crea el HostRoom, que publica el estado en Supabase y en localStorage.
- Los jugadores entran por #/room/CODIGO (join.js), guardan su identidad y pasan a
  #/play/CODIGO.
- PlayerClient envía el join; el host lo valida y responde con el estado.
- Al empezar, el host arma la cola con buildQueue, va alternando las fases y recibe los
  votos.
- En el reveal, rules.js calcula los puntos y la cuerda, y tanto la pantalla del
  anfitrión como los móviles actualizan su interfaz y la escena.
- Al terminar se muestran los resultados y se ofrece revancha o volver al lobby. La
  música sigue sonando bajita hasta que se elige una de esas opciones.

# EDITAR EL BANCO DE PREGUNTAS

- admin/panel.js carga el banco con loadBank.
- Nueva pregunta o Editar abre admin/editor.js; la categoría se elige de un desplegable.
- validateQuestion valida y se guarda con saveBank.
- Importar usa parseImport, muestra el resumen en admin/import.js y guarda. Exportar usa
  buildTemplate.

# ENVIAR UN REPORTE O SUGERENCIA

- En el pie del inicio se pulsa el enlace de reportes y se abre ui/report.js.
- El formulario se envía por fetch a Web3Forms, que lo reenvía al correo del autor.
- Si todo sale bien, el mismo cuadro cambia a una pantalla de confirmación.

-------------------------------------
15. Datos guardados en el navegador
-------------------------------------

Todo esto vive en localStorage, así que cada navegador tiene sus propios datos.

- tyg.questions.v1: el banco de preguntas.
- tyg.questions.meta y tyg.questions.seen: datos de la siembra y preguntas ya vistas.
- tyg:room:CODIGO: último estado de la sala.
- tyg:me:CODIGO: identidad del jugador en esa sala.
- tyg:host:CODIGO y tyg:hostdata:CODIGO: latido y datos privados del anfitrión.
- tyg.muted y tyg.nickname: preferencias del usuario.
- pit:last-report: hora del último reporte enviado.

------------------------------------
16. Consejos para desarrolladores
------------------------------------

- Toda pantalla que abra intervalos, canales o escenas debe devolver una función de
  limpieza.
- El orden de las hojas de estilo en index.html importa; responsive.css va al final.
- Si pruebas en el celular y no ves tus cambios, casi seguro es caché del navegador.
  Prueba en una pestaña privada o borra los datos del sitio.
- El banco de preguntas es local a cada navegador. Para compartirlo entre dispositivos
  hay que exportarlo e importarlo.