import { useEffect, useRef } from "react";
import type { Action, GameState } from "../core/types";
export function CanvasBoard({
  state,
  dispatch,
  paused,
  draw,
  keys,
  width = 720,
  height = 440,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  paused: boolean;
  draw: (
    ctx: CanvasRenderingContext2D,
    s: any,
    colors: Record<string, string>,
  ) => void;
  keys?: Record<string, string>;
  width?: number;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const current = useRef(state);
  current.current = state;
  const callback = useRef(dispatch);
  callback.current = dispatch;
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let frame = 0,
      last = 0;
    const root = getComputedStyle(document.documentElement);
    const colors: Record<string, string> = {};
    function paint(now: number) {
      for (const k of [
        "font-mono",
        "bg",
        "surface",
        "text",
        "muted",
        "accent",
        "border",
        "felt",
        "board-light",
        "board-dark",
        "piece-i",
        "piece-o",
        "piece-t",
        "piece-s",
        "piece-z",
        "piece-j",
        "piece-l",
      ])
        colors[k] = root.getPropertyValue("--" + k).trim();
      if (!paused && last && current.current.status === "playing")
        callback.current({
          type: "TICK",
          dt: Math.min((now - last) / 1000, 0.05),
        });
      last = now;
      draw(ctx, current.current, colors);
      frame = requestAnimationFrame(paint);
    }
    frame = requestAnimationFrame(paint);
    const release = () => callback.current({ type: "RELEASE" });
    window.addEventListener("blur", release);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("blur", release);
    };
  }, [paused, draw]);
  useEffect(() => {
    if (!keys) return;
    const handle = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      const type = keys[e.key];
      if (type) {
        e.preventDefault();
        if (!paused)
          callback.current({
            type,
            down: e.type === "keydown",
            repeat: e.repeat,
          });
      }
    };
    window.addEventListener("keydown", handle);
    window.addEventListener("keyup", handle);
    return () => {
      window.removeEventListener("keydown", handle);
      window.removeEventListener("keyup", handle);
    };
  }, [keys, paused]);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="game-canvas"
      aria-label="Game board / Tablero"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (!paused)
          dispatch({
            type: "POINTER",
            x: ((e.clientX - r.left) * width) / r.width,
            y: ((e.clientY - r.top) * height) / r.height,
            down: true,
          });
      }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (!paused)
          dispatch({
            type: "POINTER_MOVE",
            x: ((e.clientX - r.left) * width) / r.width,
            y: ((e.clientY - r.top) * height) / r.height,
            down: e.buttons > 0,
          });
      }}
      onPointerUp={() => dispatch({ type: "POINTER_UP" })}
    />
  );
}
export function TouchControls({
  dispatch,
  controls,
}: {
  dispatch: (a: Action) => void;
  controls: [string, string][];
}) {
  return (
    <div className="touch-controls">
      {controls.map(([type, label]) => (
        <button
          key={type}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            dispatch({ type, down: true });
          }}
          onPointerUp={() => dispatch({ type, down: false })}
          onPointerCancel={() => dispatch({ type, down: false })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function Message({ children }: { children: any }) {
  return children ? (
    <p className="game-message" role="status">
      {children}
    </p>
  ) : null;
}
