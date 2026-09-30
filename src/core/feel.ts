import { tr, type Config, type GameState, type Locale } from "./types";

export const botSpeeds = [
  ["slow", "Pausado", "Relaxed"],
  ["normal", "Normal", "Normal"],
  ["fast", "Rápido", "Fast"],
  ["step", "Paso a paso", "Step by step"],
] as const;
export function triviaLevel(config: Config): string {
  if (["easy", "medium", "hard", "expert"].includes(String(config.difficulty)))
    return String(config.difficulty);
  const legacy = Number(config.probability ?? 60);
  return legacy < 50
    ? "easy"
    : legacy < 70
      ? "medium"
      : legacy <= 85
        ? "hard"
        : "expert";
}
export function botDelay(config: Config, state: GameState) {
  const base =
    config.botSpeed === "slow" ? 2800 : config.botSpeed === "fast" ? 550 : 1500;
  // Leave time to read the actual question and the revealed answer.
  return (
    base * (state.phase === "question" ? 2 : state.phase === "reveal" ? 2.5 : 1)
  );
}

/** Contextual instructions shared by every game, without exposing private information. */
export function nextStep(id: string, s: GameState, l: Locale, config: Config = {}): string {
  const t = (es: string, en: string) => tr(l, es, en);
  if (s.status !== "playing")
    return t(
      "Puedes revisar el tablero o empezar otra partida.",
      "Review the board or start another game.",
    );
  switch (id) {
    case "trivia":
      return s.phase === "roll"
        ? t(
            "Lanza el dado para conocer tus destinos.",
            "Roll the die to find your destinations.",
          )
        : s.phase === "move"
          ? t(
              "Elige una casilla con aro. ◆ permite ganar una categoría.",
              "Choose a ringed space. ◆ earns a category.",
            )
          : s.phase === "reveal"
            ? t(
                "Compara la solución y confirma si tu respuesta era equivalente.",
                "Compare the solution and confirm an equivalent answer.",
              )
            : t(
                "Escribe tu respuesta. Una coincidencia exacta cuenta automáticamente.",
                "Type your answer. An exact match scores automatically.",
              );
    case "domino":
      return s.phase === "roundover"
        ? t(
            "Revisa los puntos y abre la siguiente ronda.",
            "Review the points and start the next round.",
          )
        : t(
            "Juega una ficha con flecha en un extremo. Sin jugada, roba o pasa.",
            "Play an arrowed tile on a matching end. Otherwise draw or pass.",
          );
    case "poker":
      return s.street === "showdown"
        ? t(
            "Revisa el reparto del bote y continúa con la siguiente mano.",
            "Review the pot distribution and start the next hand.",
          )
        : t(
            "Consulta cuánto debes igualar. Puedes pasar, igualar, subir o retirarte.",
            "Check how much you owe. Check, call, raise or fold.",
          );
    case "chess":
      return s.promotion
        ? t(
            "Elige la pieza de promoción para completar la jugada.",
            "Choose a promotion piece to complete your move.",
          )
        : s.selected
          ? t(
              "Los puntos muestran destinos legales de la pieza seleccionada.",
              "Dots show legal destinations for the selected piece.",
            )
          : t(
              "Selecciona una pieza de tu color para ver sus movimientos.",
              "Select a piece of your colour to see its moves.",
            );
    case "letters":
      return s.pending?.length
        ? t(
            "Comprueba la puntuación prevista y confirma la palabra.",
            "Check the score preview and confirm the word.",
          )
        : t(
            "Selecciona una ficha y una casilla. La primera palabra cruza ★.",
            "Select a tile and a square. The first word crosses ★.",
          );
    case "billiards":
      return s.phase === "moving"
        ? t(
            "Las bolas están en movimiento. Espera a que se detengan.",
            "The balls are moving. Wait for them to settle.",
          )
        : s.phase === "break-choice"
          ? t(
              "Decide si aceptas la mesa o repites la apertura.",
              "Accept the table or request another break.",
            )
          : s.inHand
            ? t(
                "Coloca la blanca en la zona permitida antes de apuntar.",
                "Place the cue ball in the permitted area before aiming.",
              )
            : s.breakShot || config.mode === "practice"
              ? t(
                  "Apunta en la mesa, arrastra hacia atrás y suelta para tirar.",
                  "Aim on the table, pull back and release to shoot.",
                )
              : t(
                "Anuncia bola y tronera. Arrastra hacia atrás y suelta para tirar.",
                "Call ball and pocket. Pull back and release to shoot.",
              );
    case "solitaire":
      return t(
        "Selecciona o arrastra una carta. Pista muestra una jugada disponible.",
        "Select or drag a card. Hint shows an available move.",
      );
    case "sudoku":
      return t(
        "Selecciona una casilla vacía y un número. Activa notas para candidatos.",
        "Select an empty cell and a number. Enable notes for candidates.",
      );
    case "crossword":
      return t(
        "Elige una pista y escribe. Intro cambia dirección; puedes pegar palabras.",
        "Choose a clue and type. Enter changes direction; paste whole words.",
      );
    case "wordle":
      return t(
        `Intento ${Math.min(6, (s.guesses?.length || 0) + 1)} de 6 · ✓ posición correcta · • otra posición · × ausente.`,
        `Guess ${Math.min(6, (s.guesses?.length || 0) + 1)} of 6 · ✓ correct position · • elsewhere · × absent.`,
      );
    case "ring":
      return t(
        "Responde a la definición activa o pasa para volver más tarde.",
        "Answer the active clue or pass to return later.",
      );
    case "runner":
      return t(
        "Espacio / toque para saltar. Suelta antes para un salto corto.",
        "Space / tap to jump. Release early for a short jump.",
      );
    case "flappy":
      return t(
        "Cada toque da un impulso. Apunta al centro de la próxima abertura.",
        "Each tap gives a flap. Aim for the centre of the next opening.",
      );
    case "snake":
      return t(
        "Flechas o desliza para girar. Busca la comida y deja una salida.",
        "Arrows or swipe to turn. Find food and keep an escape route.",
      );
    case "breakout":
      return s.serve
        ? t(
            "Espacio o toca para lanzar la pelota cuando estés listo.",
            "Space or tap to launch the ball when ready.",
          )
        : t(
            "Mueve la pala. Los extremos cambian el ángulo del rebote.",
            "Move the paddle. Its edges change the rebound angle.",
          );
    case "blocks":
      return t(
        "Completa filas. La sombra indica dónde caerá la pieza en el perfil moderno.",
        "Complete rows. The ghost shows the landing position in the modern profile.",
      );
    default:
      return "";
  }
}
