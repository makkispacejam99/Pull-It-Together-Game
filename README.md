# Pull It Together

Pon a prueba tu conocimiento, trabaja en equipo y gana. Dos equipos, una cuerda
y una pregunta, cada equipo decide por mayoría, la respuesta más rápida desempata
y cada acierto tira de la cuerda. Sin cuentas ni instalaciones: se juega desde el navegador.

> Proyecto gratuito y open source, creado por **MakkiDEV**.

---

## Cómo ejecutar localmente el proyecto

```powershell
pwsh -File tools/serve.ps1
Abre `http://localhost:5173/`.


> No abrir `index.html` con doble clic: los módulos ES necesitan un servidor HTTP.

---

## ¿Cómo probarlo?

1. Abre la app y pulsa "Crear sala".
2. En el lobby, pulsa Añadir más bots (reparte los bots entre Marcianos y Saturninos).
3. Pulsa "Empezar partida" y observa la pantalla del anfitrión.
4. Para probar como humano, pulsa "Abrir vista de jugador" y únete en la pestaña nueva.
5. Vuelve a la pestaña del anfitrión para ver cómo tu personaje aparece en la arena.

## ¿Cómo se puntúa?

Cada ronda, cada equipo decide por "mayoría simple". Si hay empate interno,
decide el voto más rápido entre las opciones empatadas.

| Concepto            | Puntos   |
| Acierto             | +10      |
| Bonus de velocidad  | hasta +5 |
| Contraataque        | +5       |
| Racha (2.º acierto seguido) | +2 |
| Racha (3.º o más)   | +5 |
| Fallo               | 0 |

La cuerda es la "diferencia de puntos" entre ambos equipos, con un limite de `-100 a +100`.
Si un equipo saca +100 de ventaja, gana por knockout (KO).

Ranking individual: puntos → aciertos → menor tiempo total.

---

## Estructura
index.html
assets/
  img/characters/   sprites (5 colores × 6 poses)
  img/bg/           fondos
  img/props/        decoración
  audio/            efectos
  fonts/            Press Start 2P y Jersey 15
src/
  main.js           router por hash
  core/
    host.js         autoridad de la partida (modo local)
    client.js       conexión del jugador
    rules.js        puntuación y desempates (funciones puras)
    questions.js    banco, validación, import/export
    audio.js        efectos
    utils.js
  net/bus.js        transporte local (reemplazable por Supabase)
  game/scene.js     arena: astronautas, cuerda, partículas
  ui/screens/       home, join, play, stage, admin
  styles/           tokens, base, pantallas
tools/serve.ps1

## Motor de base de datos y API utilizado
- Supabase


## Créditos

- Arte y sonido: [Kenney New Platformer Pack](https://kenney.nl), 50 Menu Interface SFX (By ColorAlpha), Poopie Pack(By Chajamakesmusic)  · CC0.
- Tipografías: Press Start 2P y Jersey 15 · SIL Open Font License.
- Diseño y código: **MakkiDEV** · proyecto **Pull It Together**.
