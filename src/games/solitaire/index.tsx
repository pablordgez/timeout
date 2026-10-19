import { PixelSprite, suits } from "../../ui/PixelSprite";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { playGameSound } from "../../core/audio";
import type {
  Action,
  Config,
  GameDefinition,
  GameViewProps,
  GuideStep,
  Locale,
} from "../../core/types";
import { labels, select, tr } from "../../core/types";
import {
  canMove,
  canPair,
  createSolitaire,
  movableRun,
  pyramidExposed,
  rankLabel,
  red,
  solitaireReducer,
  type Card,
  type Place,
  type SolitaireState,
  type Variant,
} from "./engine";
import "./solitaire.css";

const names = {
  klondike: "Klondike",
  spider: "Spider",
  freecell: "FreeCell",
  pyramid: "Pirámide",
};
const messages: Record<string, [string, string]> = {
  "invalid-move": [
    "Ese movimiento no es válido. Consulta la guía o prueba otra columna.",
    "That move is not legal. Read the guide or try another column.",
  ],
  "invalid-pair": [
    "Solo puedes retirar cartas libres que sumen 13.",
    "Only exposed cards totalling 13 can be removed.",
  ],
  "nothing-to-undo": [
    "No hay movimientos que deshacer.",
    "There are no moves to undo.",
  ],
  "empty-stock": ["El mazo está agotado.", "The stock is empty."],
  "fill-columns": [
    "Ocupa todas las columnas antes de repartir otra fila.",
    "Fill every column before dealing another row.",
  ],
  "no-hint": [
    "No hay movimientos útiles evidentes. Puedes deshacer y buscar otra ruta.",
    "No useful moves are apparent. Undo and explore another route.",
  ],
  hint: [
    "Las cartas y el destino sugeridos están marcados. La pista no garantiza resolver la partida.",
    "The suggested cards and destination are outlined. Hints do not guarantee a solution.",
  ],
};
function samePlace(a?: Place | null, b?: Place | null) {
  return !!a && !!b && a.zone === b.zone && a.index === b.index;
}
function cardName(card: Card, locale: Locale) {
  const suits =
    locale === "es"
      ? ["picas", "corazones", "diamantes", "tréboles"]
      : ["spades", "hearts", "diamonds", "clubs"];
  return `${rankLabel(card.rank)} ${suits[card.suit]}`;
}
interface BoardProps {
  state: SolitaireState;
  dispatch: (action: Action) => void;
  locale: Locale;
  paused: boolean;
  compact?: boolean;
}
interface CardDrag {
  pointerId: number;
  from: Place;
  cards: Card[];
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  overlap: number;
  moved: boolean;
  target: Place | null;
}
function Board({ state, dispatch, locale, paused, compact }: BoardProps) {
  const [selection, setSelection] = useState<Place | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<CardDrag | null>(null);
  const captureRef = useRef<HTMLButtonElement | null>(null);
  const [drag, setDrag] = useState<CardDrag | null>(null);
  const [rejected, setRejected] = useState<Place | null>(null);
  const suppressClick = useRef(false);
  function cancelDrag() {
    const current = pointerRef.current;
    pointerRef.current = null;
    setDrag(null);
    const captured = captureRef.current;
    captureRef.current = null;
    if (captured && current) {
      try {
        if (captured.hasPointerCapture(current.pointerId))
          captured.releasePointerCapture(current.pointerId);
      } catch {
        /* Pointer may already have been cancelled by the browser. */
      }
    }
  }
  useEffect(() => {
    setSelection(null);
    cancelDrag();
  }, [state.moves, state.variant, paused]);
  useEffect(() => {
    if (!rejected) return;
    const timer = setTimeout(() => setRejected(null), 500);
    return () => clearTimeout(timer);
  }, [rejected]);
  useEffect(() => {
    const cancel = () => {
      if (pointerRef.current?.moved) suppressClick.current = true;
      cancelDrag();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancel();
        setSelection(null);
      }
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key);
    };
  }, []);
  const hint = state.hint;
  const hintSource: Place | undefined = hint?.from || hint?.first;
  const hintTarget: Place | undefined = hint?.to || hint?.second;
  const disabled = paused || state.status !== "playing";
  const activeSource = drag?.moved ? drag.from : selection;
  function legalTarget(from: Place, to: Place) {
    return state.variant === "pyramid"
      ? canPair(state, from, to)
      : canMove(state, from, to);
  }
  function hitTarget(x: number, y: number): Place | null {
    const hit = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-sol-zone]");
    if (!hit || !boardRef.current?.contains(hit)) {
      if (state.variant === "pyramid") return null;
      const columns =
        boardRef.current?.querySelectorAll<HTMLElement>(".sol-column-cards");
      let candidate: HTMLElement | null = null,
        best = Infinity;
      columns?.forEach((column) => {
        const rect = column.getBoundingClientRect();
        if (
          x < rect.left - 6 ||
          x > rect.right + 6 ||
          y < rect.top ||
          y > rect.bottom + 6
        )
          return;
        const distance = Math.abs(x - (rect.left + rect.right) / 2);
        if (distance < best) {
          candidate = column;
          best = distance;
        }
      });
      return candidate
        ? {
            zone: "tableau",
            index: Number((candidate as HTMLElement).dataset.solIndex),
          }
        : null;
    }
    return {
      zone: hit.dataset.solZone as Place["zone"],
      index: Number(hit.dataset.solIndex),
    };
  }
  function beginDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    from: Place,
    card: Card,
  ) {
    if (disabled || event.button !== 0 || !event.isPrimary || !card.up) return;
    const cards =
      from.zone === "tableau"
        ? state.tableau[from.index].slice(from.offset)
        : [card];
    if (state.variant === "pyramid") {
      if (from.zone === "pyramid" && !pyramidExposed(state, from.index)) return;
    } else if (!movableRun(cards, state.variant === "spider")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const overlap =
      parseFloat(
        getComputedStyle(boardRef.current!).getPropertyValue("--sol-overlap"),
      ) || 27;
    pointerRef.current = {
      pointerId: event.pointerId,
      from,
      cards,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      overlap,
      moved: false,
      target: null,
    };
    suppressClick.current = false;
    captureRef.current = event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = pointerRef.current;
    if (!current || current.pointerId !== event.pointerId || disabled) return;
    const moved =
      current.moved ||
      Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY,
      ) > 6;
    if (!moved) return;
    event.preventDefault();
    if (!current.moved) playGameSound("solitaire", "card-lift");
    const next = {
      ...current,
      moved: true,
      x: event.clientX,
      y: event.clientY,
      target: hitTarget(event.clientX, event.clientY),
    };
    pointerRef.current = next;
    setDrag(next);
    setSelection(null);
    // Scroll wide boards near their edges without making a touch gesture move the page.
    const scroll = boardRef.current?.querySelector<HTMLElement>(".sol-scroll");
    if (scroll) {
      const bounds = scroll.getBoundingClientRect();
      const edge = 28;
      if (event.clientX > bounds.right - edge) scroll.scrollLeft += 18;
      else if (event.clientX < bounds.left + edge) scroll.scrollLeft -= 18;
    }
  }
  function endDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) {
    const current = pointerRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    pointerRef.current = null;
    setDrag(null);
    captureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current.moved) return;
    suppressClick.current = true;
    event.preventDefault();
    setSelection(null);
    if (cancelled || disabled) return;
    const target = hitTarget(event.clientX, event.clientY);
    if (
      state.variant === "pyramid" &&
      canPair(state, current.from) &&
      boardRef.current?.contains(
        document.elementFromPoint(event.clientX, event.clientY),
      )
    )
      dispatch({ type: "pair", first: current.from });
    else if (target && legalTarget(current.from, target))
      dispatch(
        state.variant === "pyramid"
          ? { type: "pair", first: current.from, second: target }
          : { type: "move", from: current.from, to: target },
      );
    else {
      setRejected({ ...current.from });
      playGameSound("solitaire", "reject");
    }
  }
  function choose(place: Place, card?: Card, pointerClick = false) {
    if (pointerClick && suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    suppressClick.current = false;
    if (disabled || (card && !card.up)) return;
    if (state.variant === "pyramid") {
      if (
        !card ||
        (place.zone === "pyramid" && !pyramidExposed(state, place.index))
      )
        return;
      if (card.rank === 13) {
        dispatch({ type: "pair", first: place });
        setSelection(null);
        return;
      }
      if (selection && !samePlace(selection, place)) {
        dispatch({ type: "pair", first: selection, second: place });
        setSelection(null);
      } else setSelection(samePlace(selection, place) ? null : place);
      return;
    }
    if (selection && !samePlace(selection, place)) {
      dispatch({
        type: "move",
        from: selection,
        to: { zone: place.zone, index: place.index },
      });
      setSelection(null);
    } else if (card) {
      setSelection(
        samePlace(selection, place) && selection?.offset === place.offset
          ? null
          : place,
      );
    }
  }
  function cardButton(
    card: Card,
    place: Place,
    style?: CSSProperties,
    unavailable = false,
  ) {
    const selected =
      samePlace(activeSource, place) &&
      (activeSource?.offset === undefined ||
        place.offset === undefined ||
        place.offset >= activeSource.offset);
    const suggested =
      (samePlace(hintSource, place) &&
        (hintSource?.offset === undefined ||
          place.offset === undefined ||
          place.offset >= hintSource.offset)) ||
      samePlace(hintTarget, place);
    const target = !!activeSource && legalTarget(activeSource, place);
    const over = drag?.moved && samePlace(drag.target, place) && target;
    const dragging =
      drag?.moved &&
      samePlace(drag.from, place) &&
      (drag.from.offset === undefined ||
        place.offset === undefined ||
        place.offset >= drag.from.offset);
    return (
      <button
        key={card.id}
        type="button"
        style={style}
        data-sol-zone={place.zone}
        data-sol-index={place.index}
        data-sol-offset={place.offset}
        data-sound={selected ? "card-slide" : "card-lift"}
        className={`sol-card ${card.up ? "" : "sol-back"} ${card.up && red(card) ? "sol-red" : ""} ${selected ? "sol-selected" : ""} ${suggested ? "sol-suggested" : ""} ${target ? "sol-target" : ""} ${over ? "sol-drop-ready" : ""} ${dragging ? "sol-drag-source" : ""} ${unavailable ? "sol-covered" : ""}`}
        disabled={disabled || !card.up || unavailable}
        aria-label={
          card.up
            ? `${cardName(card, locale)} · ${place.zone === "tableau" ? tr(locale, "columna", "column") : place.zone === "foundation" ? tr(locale, "base", "home") : place.zone === "cell" ? tr(locale, "celda", "cell") : place.zone === "pyramid" ? tr(locale, "pirámide", "pyramid") : tr(locale, "descarte", "waste")} ${place.index + 1}${selected ? tr(locale, ", seleccionada", ", selected") : ""}`
            : tr(locale, "Carta boca abajo", "Face-down card")
        }
        aria-pressed={selected}
        onClick={(event) => choose(place, card, event.detail > 0)}
        onPointerDown={(event) => beginDrag(event, place, card)}
        onPointerMove={moveDrag}
        onPointerUp={(event) => endDrag(event)}
        onPointerCancel={(event) => endDrag(event, true)}
        onLostPointerCapture={() => {
          if (pointerRef.current) {
            pointerRef.current = null;
            setDrag(null);
          }
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        {card.up ? (
          <>
            <span className="sol-corner">
              {rankLabel(card.rank)}
              <small>
                <PixelSprite
                  sprite={suits[card.suit]}
                  palette={{ k: "currentColor" }}
                />
              </small>
            </span>
            <span className="sol-top-suit" aria-hidden="true">
              <PixelSprite
                sprite={suits[card.suit]}
                palette={{ k: "currentColor" }}
              />
            </span>
            <span className="sol-center">
              <PixelSprite
                sprite={suits[card.suit]}
                palette={{ k: "currentColor" }}
              />
            </span>
            <span className="sol-bottom-suit" aria-hidden="true">
              <PixelSprite
                sprite={suits[card.suit]}
                palette={{ k: "currentColor" }}
              />
            </span>
            <span className="sol-corner sol-bottom">
              {rankLabel(card.rank)}
              <small>
                <PixelSprite
                  sprite={suits[card.suit]}
                  palette={{ k: "currentColor" }}
                />
              </small>
            </span>
          </>
        ) : (
          <span aria-hidden="true">···</span>
        )}
      </button>
    );
  }
  function empty(place: Place, text: string) {
    const highlighted =
      samePlace(hintTarget, place) ||
      (activeSource && legalTarget(activeSource, place));
    const over = drag?.moved && samePlace(drag.target, place) && highlighted;
    return (
      <button
        type="button"
        data-sol-zone={place.zone}
        data-sol-index={place.index}
        className={`sol-slot ${highlighted ? "sol-target" : ""} ${over ? "sol-drop-ready" : ""}`}
        disabled={disabled}
        onClick={(event) => choose(place, undefined, event.detail > 0)}
        aria-label={text}
      >
        {text}
      </button>
    );
  }
  function drawButton() {
    return (
      <button
        className={`sol-card sol-stock ${hint?.type === "draw" ? "sol-suggested" : ""}`}
        disabled={
          disabled ||
          (!state.stock.length &&
            (state.variant !== "klondike" || !state.waste.length))
        }
        onClick={() => {
          dispatch({ type: "draw" });
          setSelection(null);
        }}
        aria-label={tr(
          locale,
          "Robar o reciclar el mazo",
          "Draw or recycle the stock",
        )}
      >
        <span aria-hidden="true">
          {state.stock.length
            ? "···"
            : state.variant === "klondike"
              ? "↻"
              : "∅"}
        </span>
        <small>{state.stock.length}</small>
      </button>
    );
  }
  const instruction =
    state.variant === "pyramid"
      ? tr(
          locale,
          "Arrastra una carta libre sobre otra que sume 13, o pulsa las dos. Los reyes se retiran solos.",
          "Drag an exposed card onto another totalling 13, or select both. Kings are removed alone.",
        )
      : tr(
          locale,
          "Arrastra una carta o grupo al destino marcado. También puedes pulsar una carta y después su destino.",
          "Drag a card or group to an outlined destination. You can also select a card, then its destination.",
        );
  return (
    <div
      ref={boardRef}
      className={`sol-board ${compact ? "sol-compact" : ""} ${drag?.moved ? "sol-is-dragging" : ""}`}
    >
      <p className="sol-instruction">{instruction}</p>
      <p className="sol-scroll-help">
        {tr(
          locale,
          "↔ Desliza el tablero para ver todas las columnas.",
          "↔ Swipe the board to see every column.",
        )}
      </p>
      <div className="sol-scroll">
        <div className={`sol-top sol-top-${state.variant}`}>
          {state.variant !== "freecell" && (
            <div className="sol-pile">
              <span className="sol-label">{tr(locale, "Mazo", "Stock")}</span>
              {drawButton()}
            </div>
          )}
          {(state.variant === "klondike" || state.variant === "pyramid") && (
            <div className="sol-pile">
              <span className="sol-label">
                {tr(locale, "Descarte", "Waste")} · {state.waste.length}
              </span>
              <div className="sol-waste">
                {state.waste.length
                  ? state.waste
                      .slice(-3)
                      .map((card, index, cards) =>
                        cardButton(
                          card,
                          { zone: "waste", index: 0 },
                          { left: `${index * 17}px`, zIndex: index + 1 },
                          index !== cards.length - 1,
                        ),
                      )
                  : empty({ zone: "waste", index: 0 }, "—")}
              </div>
            </div>
          )}
          {state.variant === "freecell" && (
            <div className="sol-cell-group">
              {state.cells.map((card, index) => (
                <div className="sol-pile" key={index}>
                  <span className="sol-label">
                    {tr(locale, "Celda", "Cell")} {index + 1}
                  </span>
                  {card
                    ? cardButton(card, { zone: "cell", index })
                    : empty({ zone: "cell", index }, "○")}
                </div>
              ))}
            </div>
          )}
          {(state.variant === "klondike" || state.variant === "freecell") && (
            <div className="sol-foundation-group">
              {state.foundations.map((cards, index) => (
                <div className="sol-pile" key={index}>
                  <span className="sol-label">
                    {tr(locale, "Base", "Home")} {index + 1}
                  </span>
                  {cards.length
                    ? cardButton(cards.at(-1)!, { zone: "foundation", index })
                    : empty({ zone: "foundation", index }, "A")}
                </div>
              ))}
            </div>
          )}
          {state.variant === "spider" && (
            <div className="sol-progress">
              <strong>{state.completed.length} / 8</strong>
              <span>
                {tr(locale, "secuencias completas", "completed sequences")}
              </span>
              <span className="sol-sequence-icons" aria-hidden="true">
                {Array.from({ length: 8 }, (_, i) =>
                  i < state.completed.length ? "●" : "○",
                ).join(" ")}
              </span>
            </div>
          )}
        </div>
        {state.variant === "pyramid" ? (
          <div className="sol-pyramid">
            {Array.from({ length: 7 }, (_, row) => (
              <div className="sol-pyramid-row" key={row}>
                {Array.from({ length: row + 1 }, (_, col) => {
                  const index = (row * (row + 1)) / 2 + col;
                  const card = state.pyramid[index];
                  return (
                    <div className="sol-pyramid-cell" key={index}>
                      {card ? (
                        cardButton(
                          card,
                          { zone: "pyramid", index },
                          undefined,
                          !pyramidExposed(state, index),
                        )
                      ) : (
                        <span
                          className="sol-cleared"
                          aria-label={tr(
                            locale,
                            "Carta retirada",
                            "Removed card",
                          )}
                        >
                          ·
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className={`sol-tableau sol-columns-${state.tableau.length}`}>
            {state.tableau.map((cards, index) => (
              <div
                className={`sol-column ${samePlace(rejected, { zone: "tableau", index }) ? "sol-returned" : ""}`}
                key={index}
              >
                <span className="sol-label">{index + 1}</span>
                <div
                  className="sol-column-cards"
                  data-sol-zone="tableau"
                  data-sol-index={index}
                  style={{
                    height: `calc(var(--sol-height) * 1.95 + ${Math.max(0, cards.length - 1)} * var(--sol-overlap))`,
                  }}
                >
                  {empty(
                    { zone: "tableau", index },
                    tr(locale, "Libre", "Empty"),
                  )}
                  {cards.map((card, offset) =>
                    cardButton(
                      card,
                      { zone: "tableau", index, offset },
                      {
                        top: `calc(${offset} * var(--sol-overlap))`,
                        zIndex: offset + 1,
                      },
                    ),
                  )}
                  {activeSource &&
                    legalTarget(activeSource, { zone: "tableau", index }) && (
                      <div
                        aria-hidden="true"
                        className={`sol-landing ${samePlace(drag?.target, { zone: "tableau", index }) ? "sol-landing-active" : ""}`}
                        style={{
                          top: `calc(${cards.length} * var(--sol-overlap))`,
                        }}
                      >
                        <span>↓</span>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="sol-tools">
        <button className="sd-button"
          disabled={paused || !state.history.length}
          onClick={() => dispatch({ type: "undo" })}
        >
          {tr(locale, "↶ Deshacer", "↶ Undo")}
        </button>
        <button className="sd-button" disabled={disabled} onClick={() => dispatch({ type: "hint" })}>
          {tr(locale, "◇ Pista", "◇ Hint")}
        </button>
        {selection && (
          <button className="sd-button" onClick={() => setSelection(null)}>
            {tr(locale, "Cancelar selección", "Clear selection")}
          </button>
        )}
        <span>
          {tr(locale, "Movimientos", "Moves")}: {state.moves} ·{" "}
          {tr(locale, "Puntos", "Points")}: {state.score}
        </span>
      </div>
      <p
        className={`sol-message ${rejected ? "sol-message-rejected" : ""}`}
        role="status"
      >
        {rejected
          ? tr(
              locale,
              "Ese destino no admite estas cartas. Prueba una columna marcada.",
              "That destination cannot receive these cards. Try an outlined column.",
            )
          : state.status === "won"
            ? tr(locale, "¡Solitario completado!", "Solitaire complete!")
            : state.message && messages[state.message]
              ? messages[state.message][locale === "es" ? 0 : 1]
              : "\u00a0"}
      </p>
      {drag?.moved &&
        createPortal(
          <div
            className={`sol-drag-ghost ${drag.target && legalTarget(drag.from, drag.target) ? "sol-ghost-valid" : ""}`}
            aria-hidden="true"
            style={
              {
                left: drag.x - drag.offsetX,
                top: drag.y - drag.offsetY,
                width: drag.width,
                height: drag.height + (drag.cards.length - 1) * drag.overlap,
                "--sol-width": `${drag.width}px`,
                "--sol-height": `${drag.height}px`,
                "--sol-overlap": `${drag.overlap}px`,
              } as CSSProperties
            }
          >
            {drag.cards.map((card, index) => (
              <div
                key={card.id}
                className={`sol-card ${red(card) ? "sol-red" : ""}`}
                style={{
                  position: "absolute",
                  top: index * drag.overlap,
                  zIndex: index + 1,
                }}
              >
                <span className="sol-corner">
                  {rankLabel(card.rank)}
                  <small>
                    <PixelSprite
                      sprite={suits[card.suit]}
                      palette={{ k: "currentColor" }}
                    />
                  </small>
                </span>
                <span className="sol-top-suit" aria-hidden="true">
                  <PixelSprite
                    sprite={suits[card.suit]}
                    palette={{ k: "currentColor" }}
                  />
                </span>
                <span className="sol-center">
                  <PixelSprite
                    sprite={suits[card.suit]}
                    palette={{ k: "currentColor" }}
                  />
                </span>
                <span className="sol-bottom-suit" aria-hidden="true">
                  <PixelSprite
                    sprite={suits[card.suit]}
                    palette={{ k: "currentColor" }}
                  />
                </span>
                <span className="sol-corner sol-bottom">
                  {rankLabel(card.rank)}
                  <small>
                    <PixelSprite
                      sprite={suits[card.suit]}
                      palette={{ k: "currentColor" }}
                    />
                  </small>
                </span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

const rules: Record<Variant, [string, string][]> = {
  klondike: [
    [
      "Construye cuatro bases por palo, del as al rey. En las columnas, baja un valor alternando rojo y negro.",
      "Build four home piles by suit, from ace to king. Tableau columns descend by rank, alternating red and black.",
    ],
    [
      "Puedes mover grupos ordenados. Solo un rey, solo o con su grupo, puede ocupar una columna vacía. Al liberar una carta tapada, se gira automáticamente.",
      "Ordered groups can move together. Only a king, alone or with its group, can fill an empty column. Newly uncovered cards turn face up.",
    ],
    [
      "Roba una o tres cartas según la configuración; solo la superior del descarte está disponible. Recicla el descarte cuando se agote el mazo, sin límite de vueltas. Puedes devolver cartas desde las bases.",
      "Draw one or three cards according to your setting; only the top waste card is available. Recycle the waste when the stock empties, with unlimited passes. Home cards can return to the tableau.",
    ],
  ],
  spider: [
    [
      "Forma ocho secuencias completas del rey al as del mismo palo. Se retiran automáticamente al completarlas.",
      "Build eight complete same-suit sequences from king to ace. Completed sequences are removed automatically.",
    ],
    [
      "Puedes colocar una carta sobre otra de valor inmediatamente superior, de cualquier palo. Solo los grupos consecutivos del mismo palo se trasladan juntos. Cualquier carta o grupo válido puede llenar un hueco.",
      "Place a card on the next higher rank, regardless of suit. Only consecutive same-suit groups move together. Any card or valid group can fill an empty column.",
    ],
    [
      "El mazo reparte diez cartas, una por columna. Todas las columnas deben estar ocupadas antes de repartir. Con dos o cuatro palos tendrás que separar los grupos mezclados.",
      "The stock deals ten cards, one per column. Every column must contain a card before dealing. With two or four suits, mixed groups need separating.",
    ],
  ],
  freecell: [
    [
      "Todas las cartas están visibles. Construye las cuatro bases por palo del as al rey y las columnas alternando color en orden descendente.",
      "Every card is visible. Build the four homes by suit from ace to king, and tableau columns in descending rank with alternating colours.",
    ],
    [
      "Las cuatro celdas guardan una carta cada una. Una columna vacía acepta cualquier carta. Mantener espacios libres es esencial.",
      "Each of the four free cells holds one card. Any card can fill an empty column. Keeping spaces free is essential.",
    ],
    [
      "Para mover un grupo, debe poder trasladarse carta a carta: capacidad = (celdas libres + 1) × 2 elevado a columnas libres. Si el destino está vacío, no cuenta como columna auxiliar.",
      "A group must be movable one card at a time: capacity = (free cells + 1) × 2 to the power of free columns. An empty destination does not count as an auxiliary column.",
    ],
  ],
  pyramid: [
    [
      "Retira pares que sumen 13: A vale 1, J 11, Q 12 y K 13. Los reyes se retiran solos.",
      "Remove pairs totalling 13: A is 1, J is 11, Q is 12 and K is 13. Kings are removed alone.",
    ],
    [
      "Una carta de la pirámide está libre cuando las dos cartas que la cubren ya se han retirado. Puedes combinar dos cartas libres o una libre con la superior del descarte.",
      "A pyramid card is exposed when both cards covering it have been removed. Pair two exposed cards, or one exposed card with the top waste card.",
    ],
    [
      "Roba una carta cada vez. En esta variante hay una sola vuelta del mazo; puedes deshacer. Ganas al vaciar la pirámide aunque sobren cartas en el mazo.",
      "Draw one card at a time. This variant allows one stock pass; you can undo. Clear the pyramid to win, even if stock cards remain.",
    ],
  ],
};

function practice(variant: Variant): SolitaireState {
  const s = createSolitaire({ variant, suits: 1 }, 17);
  s.tableau = [];
  s.stock = [];
  s.waste = [];
  s.pyramid = [];
  s.cells = [null, null, null, null];
  let id = 0;
  const c = (rank: number, suit: number, up = true): Card => ({
    id: id++,
    rank,
    suit,
    up,
  });
  if (variant === "klondike") {
    s.tableau = [
      [c(7, 0, false), c(6, 1), c(5, 0)],
      [c(7, 3)],
      [],
      [],
      [],
      [],
      [],
    ];
    s.waste = [c(1, 2)];
  }
  if (variant === "spider") {
    s.tableau = [
      [c(7, 0, false), c(6, 0), c(5, 0)],
      [c(7, 1)],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ];
  }
  if (variant === "freecell") {
    s.tableau = [[c(6, 1), c(5, 0)], [c(7, 3)], [c(1, 2)], [], [], [], [], []];
  }
  if (variant === "pyramid") {
    s.pyramid = Array.from({ length: 28 }, () => null);
    s.pyramid[21] = c(6, 0);
    s.pyramid[22] = c(7, 1);
    s.pyramid[23] = c(13, 3);
    s.pyramid[15] = c(1, 1);
    s.waste = [c(12, 0)];
  }
  return s;
}
function SolitaireView(props: GameViewProps<SolitaireState>) {
  const { state, config, locale, paused, practice } = props;
  return (
    <section className={`solitaire ${practice ? "sol-demo" : ""}`}>
      <div className="sol-meta">
        <strong>
          {state.variant === "pyramid"
            ? tr(locale, "Pirámide", "Pyramid")
            : names[state.variant]}
        </strong>
        <span>
          {state.variant === "klondike"
            ? tr(
                locale,
                `Robo de ${config.draw || 1}`,
                `Draw ${config.draw || 1}`,
              )
            : state.variant === "spider"
              ? tr(
                  locale,
                  `${config.suits || 1} palo(s)`,
                  `${config.suits || 1} suit(s)`,
                )
              : tr(locale, "Baraja de 52 cartas", "52-card deck")}
        </span>
      </div>
      <Board {...props} />
      {paused && (
        <p className="sol-paused">
          {tr(
            locale,
            "Partida en pausa. Reanuda para jugar.",
            "Game paused. Resume to play.",
          )}
        </p>
      )}
    </section>
  );
}

const solitaireGuidesByVariant: Record<Variant, GuideStep[]> = {
  klondike: [
    {
      title: labels("Cuatro bases por palo", "Four home piles by suit"),
      text: labels(
        "Construye cuatro bases en la parte superior, una por cada palo, del As al Rey. Llevar todas las cartas a las bases completa el juego.",
        "Build four foundation piles at the top, one per suit, from Ace to King. Moving all cards to foundations wins the game.",
      ),
      diagram: "[A♠] → [2♠] … [K♠] × 4",
      action: { type: "hint" },
    },
    {
      title: labels("Construye alternando colores", "Build alternating colors"),
      text: labels(
        "En las 7 columnas del tablero, desciende de rango alternando rojo y negro (por ejemplo, 6♥ sobre 7♠ o 5♠ sobre 6♥). Puedes mover secuencias ordenadas juntas.",
        "In the 7 tableau columns, build downward alternating red and black (e.g. 6♥ on 7♠ or 5♠ on 6♥). Ordered sequences move together.",
      ),
      diagram: "[7♠] ── [6♥] ── [5♠]   |   rojo / negro ✓",
      action: { type: "hint" },
    },
    {
      title: labels("Reyes y columnas vacías", "Kings and empty columns"),
      text: labels(
        "Solo un Rey (o una secuencia que comience por un Rey) puede colocarse en una columna vacía. Al mover una carta y liberar una carta oculta, esta se gira automáticamente.",
        "Only a King (or a sequence starting with a King) can fill an empty column. Uncovering a face-down card turns it face-up automatically.",
      ),
      diagram: "[Columna vacía] ← [K♠]",
    },
    {
      title: labels("Mazo de robo y reciclaje", "Stock draw and recycling"),
      text: labels(
        "Roba del mazo cuando no tengas movimientos en el tablero. Solo la carta superior del descarte está en juego. Puedes reciclar el mazo cuantas veces quieras y devolver cartas de las bases al tablero si es necesario.",
        "Draw from stock when no moves remain on the tableau. Only the top waste card is in play. You can recycle the stock without limit and move cards back from foundations if needed.",
      ),
      diagram: "[Mazo] → [Descarte] → [Tablero]",
      action: { type: "hint" },
    },
  ],
  spider: [
    {
      title: labels("Ocho secuencias completas", "Eight complete sequences"),
      text: labels(
        "El objetivo es formar ocho secuencias completas en el tablero, desde el Rey hasta el As del mismo palo. Al completar una secuencia entera (K a A), se retira automáticamente a la base.",
        "Build eight complete sequences on the tableau from King to Ace of the same suit. A completed sequence (K to A) automatically moves to completed piles.",
      ),
      diagram: "K♠ → Q♠ → J♠ … A♠   × 8",
      action: { type: "hint" },
    },
    {
      title: labels("Construcción y grupos del mismo palo", "Building and same-suit groups"),
      text: labels(
        "Puedes colocar una carta sobre cualquier otra de valor inmediatamente superior (ej. 6 sobre 7 de cualquier palo). Sin embargo, ¡solo los grupos consecutivos del MISMO palo pueden moverse juntos!",
        "You can place a card on any card of the next higher rank (e.g. 6 on 7 of any suit). However, only consecutive groups of the SAME suit can move together!",
      ),
      diagram: "[7♠] ── [6♠] ── [5♠]   |   mismo palo ✓",
      action: { type: "hint" },
    },
    {
      title: labels("Reparto del mazo", "Stock dealing"),
      text: labels(
        "Cualquier carta o grupo válido puede llenar una columna vacía. Cuando no queden movimientos útiles, pulsa el mazo para repartir diez cartas (una por columna). ¡Todas las columnas deben tener al menos una carta para poder repartir!",
        "Any card or valid group can fill an empty column. When stuck, tap the stock to deal ten cards (one per column). Every column must have at least one card to deal!",
      ),
      diagram: "Mazo → 1 carta × 10 columnas",
    },
    {
      title: labels("Destapar cartas ocultas", "Uncovering hidden cards"),
      text: labels(
        "Mueve cartas y grupos para voltear las cartas boca abajo. Cada carta descubierta amplía tus posibilidades. Si juegas con 2 o 4 palos, separa las mezclas para reagrupar por palo.",
        "Move cards to flip face-down cards. Each revealed card expands your options. With 2 or 4 suits, break mixed stacks to regroup by pure suit.",
      ),
      diagram: "[7♠ tapada] → [6♠ 5♠] sobre [7♥] → [7♠ visible!]",
      action: { type: "hint" },
    },
  ],
  freecell: [
    {
      title: labels("Cartas visibles y 4 celdas libres", "Open cards and 4 free cells"),
      text: labels(
        "Todas las cartas se reparten descubiertas desde el inicio. Dispones de cuatro celdas libres en la parte superior para almacenar temporalmente una carta en cada una.",
        "All cards are dealt face-up. You have four free cells at the top to temporarily store one card each while maneuvering.",
      ),
      diagram: "○ ○ ○ ○   |   4 celdas libres",
      action: { type: "hint" },
    },
    {
      title: labels("Cuatro bases y cascadas", "Four homes and cascades"),
      text: labels(
        "Construye las cuatro bases por palo del As al Rey. En las 8 columnas del tablero, construye en orden descendente alternando color (rojo sobre negro, etc.).",
        "Build the four home piles by suit from Ace to King. In the 8 tableau cascades, build down alternating colors (red on black, etc.).",
      ),
      diagram: "[A♠] → [2♠] … [K♠]   |   [6♦] sobre [7♣]",
      action: { type: "hint" },
    },
    {
      title: labels("Capacidad de movimiento en bloque", "Supermove block capacity"),
      text: labels(
        "Para mover varias cartas juntas, debes disponer de suficientes celdas y columnas libres para trasladarlas una a una: capacidad = (celdas libres + 1) × 2^(columnas libres). ¡Aprovecha los espacios vacíos!",
        "Moving multiple cards together requires enough free cells and empty columns to move them card by card: capacity = (free cells + 1) × 2^(empty columns). Use empty spaces wisely!",
      ),
      diagram: "(celdas libres + 1) × 2^columnas",
      action: { type: "hint" },
    },
    {
      title: labels("Estrategia y columnas vacías", "Strategy and empty cascades"),
      text: labels(
        "Una columna vacía puede ocuparse con cualquier carta o grupo permitido. Procura mantener celdas libres desocupadas para no quedarte sin movimientos posibles.",
        "An empty cascade accepts any card or allowed group. Aim to keep free cells vacant so you never run out of maneuvering capacity.",
      ),
      diagram: "[Columna vacía] ← Cualquier carta",
    },
  ],
  pyramid: [
    {
      title: labels("El objetivo: Sumar 13", "The goal: Sum to 13"),
      text: labels(
        "Retira las cartas de la pirámide emparejando dos cartas descubiertas que sumen 13. Valores: As = 1, J = 11, Q = 12, Rey = 13. Los números 2 a 10 valen su cifra.",
        "Clear pyramid cards by pairing exposed cards that add up to 13. Values: Ace = 1, J = 11, Q = 12, King = 13. Numbers 2–10 equal their rank.",
      ),
      diagram: "[6♠] + [7♥] = 13 ✓   |   [A♦] + [Q♣] = 13 ✓",
      action: { type: "hint" },
    },
    {
      title: labels("Los Reyes se van solos", "Kings clear alone"),
      text: labels(
        "Dado que el Rey vale 13 por sí mismo, no necesita pareja: basta seleccionarlo para retirarlo de inmediato del tablero.",
        "Since the King equals 13 on its own, it needs no pair: simply select it to remove it immediately from the board.",
      ),
      diagram: "[K♠] = 13 → ¡Retirar solo! ✓",
      action: { type: "hint" },
    },
    {
      title: labels("Cartas libres y desbloqueo", "Exposed cards and unblocking"),
      text: labels(
        "Una carta de la pirámide está libre solo cuando las dos cartas que la cubren en la fila inferior han sido retiradas. Puedes emparejar dos cartas libres entre sí o una libre con la del descarte.",
        "A pyramid card is exposed only when both cards overlapping it in the row below are removed. Pair two exposed pyramid cards, or one exposed card with the top waste card.",
      ),
      diagram: "[Carta libre] + [Descarte] = 13 ✓",
      action: { type: "hint" },
    },
    {
      title: labels("Mazo de robo y descartes", "Stock draw and waste"),
      text: labels(
        "Roba del mazo para descubrir nuevas cartas con las que emparejar cartas libres de la pirámide. Solo hay una vuelta al mazo; puedes usar Deshacer para retroceder si te equivocas.",
        "Draw from stock to uncover cards to pair with exposed pyramid cards. The deck is dealt once; use Undo if you make a mistake.",
      ),
      diagram: "[Mazo] → [Descarte] ── [Pirámide]",
      action: { type: "hint" },
    },
  ],
};

const getSolitaireGuide = (variant: Variant): GuideStep[] =>
  solitaireGuidesByVariant[variant] || solitaireGuidesByVariant.klondike;

const solitaireGuideFn = (c?: Config): GuideStep[] =>
  getSolitaireGuide((c?.variant || "klondike") as Variant);

export const solitaire: GameDefinition<SolitaireState> = {
  id: "solitaire",
  name: labels("Solitarios", "Solitaire"),
  icon: "♠",
  category: "cards",
  version: 1,
  description: labels(
    "Klondike, Spider, FreeCell y Pirámide.",
    "Four classic card games at your own pace.",
  ),
  defaults: { variant: "klondike", draw: 1, suits: 1 },
  options: [
    select(
      "variant",
      "Variante",
      "Variant",
      [
        ["klondike", "Klondike", "Klondike"],
        ["spider", "Spider", "Spider"],
        ["freecell", "FreeCell", "FreeCell"],
        ["pyramid", "Pirámide", "Pyramid"],
      ],
      "klondike",
    ),
    select(
      "draw",
      "Klondike: cartas por robo",
      "Klondike: cards per draw",
      [
        [1, "Una", "One"],
        [3, "Tres", "Three"],
      ],
      1,
      (c) => c.variant === "klondike",
    ),
    select(
      "suits",
      "Spider: número de palos",
      "Spider: number of suits",
      [
        [1, "Uno", "One"],
        [2, "Dos", "Two"],
        [4, "Cuatro", "Four"],
      ],
      1,
      (c) => c.variant === "spider",
    ),
  ],
  create: createSolitaire,
  practice: (c) => practice((c.variant || "klondike") as Variant),
  reducer: solitaireReducer,
  View: SolitaireView,
  guide: solitaireGuideFn as any,
  summarize: (state, config) => ({
    variant: state.variant,
    draw: Number(config.draw || 1),
    suits: Number(config.suits || 1),
    completed: state.completed.length,
  }),
};
export default solitaire;
