import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { CanvasBoard } from "../../ui/shared";
import { tr, type Action, type GameViewProps } from "../../core/types";
import { pockets, permittedTargets, type PoolState } from "./engine";
import { dragShot, directedShot, type Point } from "./preview";
import { playGameSound } from "../../core/audio";
interface Gesture {
  pointer: number;
  start: Point;
  current: Point;
  angle: number;
  power: number;
  distance: number;
  aiming: boolean;
  locked: boolean;
}
type Draw = (
  ctx: CanvasRenderingContext2D,
  s: PoolState,
  colors: Record<string, string>,
  practice: boolean,
) => void;
/** Drag state belongs to the UI. A cancelled or saved drag is never a pending shot. */
export function PoolSurface({
  state: s,
  dispatch,
  config: c,
  locale: l,
  paused,
  draw,
  locked = true,
}: GameViewProps<PoolState> & { draw: Draw; locked?: boolean }) {
  const wrapper = useRef<HTMLDivElement>(null),
    gesture = useRef<Gesture | null>(null),
    hover = useRef<number | null>(null),
    [power, setPower] = useState<number | null>(null);
  const ready =
    !paused &&
    s.phase === "aim" &&
    s.status === "playing" &&
    (c.mode === "practice" || s.turn < Number(c.humans || 1));
  const cancel = useCallback(() => {
    const g = gesture.current;
    gesture.current = null;
    hover.current = null;
    setPower(null);
    if (g && wrapper.current?.hasPointerCapture(g.pointer))
      wrapper.current.releasePointerCapture(g.pointer);
  }, []);
  useEffect(() => {
    if (!ready) cancel();
  }, [ready, cancel]);
  useEffect(() => {
    hover.current = null;
  }, [s.angle, s.turn, s.inHand, s.phase]);
  useEffect(() => {
    window.addEventListener("blur", cancel);
    const hidden = () => {
        if (document.visibilityState === "hidden") cancel();
      },
      escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") cancel();
      };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("keydown", escape);
    };
  }, [cancel]);
  const paint = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      state: PoolState,
      colors: Record<string, string>,
    ) => {
      const g = gesture.current;
      draw(
        ctx,
        g
          ? { ...state, angle: g.angle, power: g.power, pull: g.distance }
          : hover.current !== null
            ? { ...state, angle: hover.current }
            : state,
        colors,
        c.mode === "practice",
      );
    },
    [draw, c.mode],
  );
  const filteredDispatch = useCallback(
    (a: Action) => {
      if (!["POINTER", "POINTER_MOVE", "POINTER_UP"].includes(a.type))
        dispatch(a);
    },
    [dispatch],
  );
  const point = (e: PointerEvent<HTMLDivElement>): Point => {
    const bounds = wrapper
      .current!.querySelector("canvas")!
      .getBoundingClientRect();
    return {
      x: ((e.clientX - bounds.left) * 720) / bounds.width,
      y: ((e.clientY - bounds.top) * 400) / bounds.height,
    };
  };
  const begin = (e: PointerEvent<HTMLDivElement>) => {
    if (!ready || e.button !== 0 || gesture.current) return;
    e.preventDefault();
    const p = point(e);
    if (s.inHand) {
      dispatch({ type: "PLACE", ...p });
      return;
    }
    const pocket = pockets.findIndex(
      ([x, y]) => Math.hypot(x - p.x, y - p.y) < 27,
    );
    if (pocket >= 0 && !s.breakShot && c.mode !== "practice") {
      dispatch({ type: "CALL_POCKET", pocket });
      return;
    }
    const cue = s.balls.find((b) => b.id === 0)!;
    const angle =
      Math.hypot(p.x - cue.x, p.y - cue.y) > 42
        ? Math.atan2(p.y - cue.y, p.x - cue.x)
        : (hover.current ?? s.angle);
    // Mouse: point, pull anywhere, release. Touch: aim first, pull near the cue ball.
    const aiming =
      e.pointerType === "touch" && Math.hypot(p.x - cue.x, p.y - cue.y) > 42;
    gesture.current = {
      pointer: e.pointerId,
      start: p,
      current: p,
      angle,
      power: s.power,
      distance: 0,
      aiming,
      locked,
    };
    wrapper.current!.setPointerCapture(e.pointerId);
    dispatch({ type: "AIM", angle });
    setPower(aiming ? null : 0);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!ready || s.inHand) return;
    if (!g) {
      if (e.pointerType === "touch" || e.buttons) return;
      const p = point(e),
        cue = s.balls.find((b) => b.id === 0)!;
      if (Math.hypot(p.x - cue.x, p.y - cue.y) > 42)
        hover.current = Math.atan2(p.y - cue.y, p.x - cue.x);
      return;
    }
    if (g.pointer !== e.pointerId) return;
    e.preventDefault();
    const current = point(e);
    if (g.aiming) {
      const cue = s.balls.find((b) => b.id === 0)!;
      gesture.current = {
        ...g,
        current,
        angle: Math.atan2(current.y - cue.y, current.x - cue.x),
      };
      return;
    }
    const shot = g.locked
      ? directedShot(g.start, current, g.angle)
      : dragShot(g.start, current);
    gesture.current = { ...g, current, ...shot };
    setPower(shot.distance >= 8 ? Math.round(shot.power / 11) : 0);
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    e.preventDefault();
    const p = point(e),
      shot = g.locked
        ? directedShot(g.start, p, g.angle)
        : dragShot(g.start, p);
    cancel();
    if (!ready) return;
    if (g.aiming) {
      dispatch({ type: "AIM", angle: g.angle });
    }
    if (!g.aiming && shot.distance >= 8) {
      dispatch({ type: "SHOOT", angle: shot.angle, power: shot.power });
      return;
    }
    // A tap selects a legal target or numbered pocket; empty cloth simply aims.
    const pocket = pockets.findIndex(
      ([x, y]) => Math.hypot(x - p.x, y - p.y) < 27,
    );
    if (pocket >= 0 && !s.breakShot && c.mode !== "practice") {
      dispatch({ type: "CALL_POCKET", pocket });
      return;
    }
    const target = s.balls.find(
      (b) =>
        !b.pocketed &&
        b.id &&
        Math.hypot(b.x - p.x, b.y - p.y) < 20 &&
        permittedTargets(s, c).includes(b.id),
    );
    if (target && !s.breakShot && c.mode !== "practice")
      dispatch({ type: "CALL_BALL", id: target.id });
  };
  return (
    <>
      <div
        ref={wrapper}
        className={`pool-surface ${power !== null ? "pool-charging" : ""}`}
        data-phase={s.phase}
        tabIndex={ready ? 0 : -1}
        role="region"
        aria-label={tr(
          l,
          "Mesa de billar. Flechas para ajustar dirección; Espacio para tirar.",
          "Pool table. Arrow keys adjust aim; Space shoots.",
        )}
        onKeyDown={(e) => {
          if (!ready || s.inHand) return;
          if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            cancel();
            dispatch({
              type: "AIM",
              angle:
                s.angle +
                ((e.key === "ArrowLeft" ? -1 : 1) *
                  (e.shiftKey ? 0.1 : 0.5) *
                  Math.PI) /
                  180,
            });
          }
          if (e.key === " " && !e.repeat) {
            e.preventDefault();
            const angle = hover.current ?? s.angle;
            cancel();
            dispatch({ type: "SHOOT", angle });
          }
          if (e.key === "Escape") {
            cancel();
            playGameSound("billiards", "cancel");
          }
        }}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onPointerLeave={() => {
          if (!gesture.current) hover.current = null;
        }}
      >
        <CanvasBoard
          state={s}
          dispatch={filteredDispatch}
          paused={paused}
          draw={paint}
          width={720}
          height={400}
        />
        {power !== null && (
          <div className="pool-charge-meter" aria-hidden="true">
            <span style={{ height: `${power}%` }} />
            <b>{power}%</b>
          </div>
        )}
      </div>
      <p className="pool-drag-help" aria-live="polite">
        {s.inHand
          ? tr(
              l,
              s.behindHead
                ? "Coloca la blanca a la izquierda de la línea."
                : "Coloca la blanca en un espacio libre.",
              s.behindHead
                ? "Place the cue ball to the left of the line."
                : "Place the cue ball on empty cloth.",
            )
          : power === null
            ? tr(
                l,
                "Apunta con el ratón, arrastra hacia atrás y suelta para tirar. En pantalla táctil, apunta y tira desde la blanca.",
                "Aim with the mouse, pull back and release to shoot. On touchscreens, aim first, then pull from the cue ball.",
              )
            : `${tr(l, "Potencia del tirón", "Drag power")}: ${power}% · ${tr(l, "Suelta para tirar · Escape cancela", "Release to shoot · Escape cancels")}`}
      </p>
    </>
  );
}
