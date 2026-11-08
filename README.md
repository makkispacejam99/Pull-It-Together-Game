<div align="center">

# Pull It Together

**Pon a prueba tu conocimiento, trabaja en equipo y gana.**  
Un juego de trivia multijugador en tiempo real donde dos equipos tiran de una cuerda digital basados en sus aciertos, velocidad y trabajo en equipo.

[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen.svg)](https://github.com/)
[![License: MIT / CC0](https://img.shields.io/badge/License-CC0%20%2F%20MIT-blue.svg)](LICENSE)
[![Built with Vanilla JS](https://img.shields.io/badge/Stack-Vanilla%20JS%20%2F%20Supabase-orange.svg)](https://supabase.com)

</div>

## ¿De qué trata?

Dos equipos, una cuerda y una pregunta. Cada equipo decide por mayoría la respuesta correcta; la respuesta más rápida desempata y cada acierto tira de la cuerda.

* **Sin instalaciones complejas:** Funciona directamente desde el navegador.
* **Multijugador local / bots:** Prueba con bots en el lobby o abre múltiples vistas de jugador.
* **Dinámica de Cuerda:** La diferencia de puntos marca la tensión en la arena virtual (límite de -100 a +100 para victoria por knockout).

## Cómo ejecutar localmente el proyecto

> **Nota:** No abras `index.html` directamente con doble clic. Los módulos ES necesitan un servidor HTTP para funcionar correctamente.

1. Clona el repositorio o descarga el proyecto.
2. Ejecuta el script de PowerShell para levantar el servidor local:
   ```powershell
   pwsh -File tools/serve.ps1

Abre tu navegador en http://localhost:5173/.

## ¿Cómo probarlo?
Abre la aplicación en tu navegador y pulsa "Crear sala".En el lobby, pulsa "Añadir más bots" (reparte los bots entre los equipos Marcianos y Saturninos).Pulsa "Empezar partida" y observa la pantalla del anfitrión.Para probar la experiencia de un jugador real, pulsa "Abrir vista de jugador" y únete desde una pestaña nueva.Vuelve a la pestaña del anfitrión para ver en tiempo real cómo tu personaje aparece y reacciona en la arena.¿Cómo se puntúa?Cada ronda, los equipos deciden por mayoría simple. Si hay empate interno, el voto más rápido define el desempate.

## Motor de base de datos y API utilizado
Supabase

## Créditos 
Arte y Sonido:Kenney New Platformer Pack (CC0), 50 Menu Interface SFX por ColorAlpha (CC0), Poopie Pack por Chajamakesmusic (CC0),
Tipografías:Press Start 2P y Jersey 15 bajo licencia SIL Open Font License.

Creado con ❤️ por MakkiDEV 
