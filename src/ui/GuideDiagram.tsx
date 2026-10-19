import type { ReactNode } from "react";
import type { Locale } from "../core/types";

interface GuideDiagramProps {
  diagram: string;
  gameId?: string;
  locale?: Locale;
}

const CHESS_PIECES = new Set([
  "♜", "♞", "♝", "♛", "♚", "♟",
  "♖", "♘", "♗", "♕", "♔", "♙", "·",
]);

const SUITS_SET = new Set(["♠", "♥", "♦", "♣"]);

function isChessGrid(text: string): boolean {
  const lines = text.trim().split("\n");
  if (lines.length < 3) return false;
  return lines.every((line) => {
    const chars = line.trim().split(/\s+/);
    return chars.length >= 6 && chars.every((c) => CHESS_PIECES.has(c));
  });
}

function renderChessGrid(text: string): ReactNode {
  const rows = text.trim().split("\n").map((line) => line.trim().split(/\s+/));
  return (
    <div className="guide-chess-board" role="img" aria-label="Tablero de ajedrez">
      {rows.map((row, r) => (
        <div key={r} className="guide-chess-row">
          {row.map((cell, c) => {
            const isDark = (r + c) % 2 === 1;
            const isPiece = cell !== "·";
            return (
              <span
                key={c}
                className={`guide-chess-cell ${isDark ? "cell-dark" : "cell-light"}`}
              >
                {isPiece ? cell : ""}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function isWordlePattern(text: string): boolean {
  return /^[A-ZÑ]\s+[✓•×](\s+[A-ZÑ]\s+[✓•×])*$/.test(text.trim());
}

function renderWordlePattern(text: string): ReactNode {
  const tokens = text.trim().split(/\s+/);
  const items: { letter: string; state: "correct" | "present" | "absent" }[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const letter = tokens[i];
    const mark = tokens[i + 1];
    const state =
      mark === "✓" ? "correct" : mark === "•" ? "present" : "absent";
    items.push({ letter, state });
  }
  return (
    <div className="guide-wordle-row">
      {items.map((item, idx) => (
        <div key={idx} className={`guide-wordle-tile tile-${item.state}`}>
          <span className="tile-letter">{item.letter}</span>
          <span className="tile-mark">
            {item.state === "correct" ? "✓" : item.state === "present" ? "•" : "×"}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderCardHand(content: string, key: string | number): ReactNode {
  const rawCards = content.split(/\s+/);
  return (
    <span key={key} className="guide-card-group">
      {rawCards.map((c, i) => renderCardToken(c, `${key}-${i}`))}
    </span>
  );
}

function renderCardToken(token: string, key: string | number): ReactNode {
  const match = token.match(/^(10|[2-9AJQK])([♠♥♦♣])$/);
  if (!match) return <span key={key}>{token}</span>;
  const [, rank, suit] = match;
  const isRed = suit === "♥" || suit === "♦";
  return (
    <span
      key={key}
      className={`guide-card-chip ${isRed ? "card-red" : "card-black"}`}
    >
      <span className="card-rank">{rank}</span>
      <span className="card-suit">{suit}</span>
    </span>
  );
}

function renderDominoToken(token: string, key: string | number): ReactNode {
  const match = token.match(/^\[(\d)\|(\d)\]$/);
  if (!match) return <span key={key}>{token}</span>;
  const [, a, b] = match;
  return (
    <span key={key} className="guide-domino-stone">
      <span className="domino-half">{a}</span>
      <span className="domino-bar" />
      <span className="domino-half">{b}</span>
    </span>
  );
}

function renderLineTokens(line: string): ReactNode[] {
  // Matches card groups [A♠ K♠], dominoes [2|6], individual cards 7♣, arrows, or general words
  const parts: ReactNode[] = [];
  const regex = /(\[[^\]]+\]|\d+\s*[♠♥♦♣]|[A-ZÑ]\s*[♠♥♦♣]|10[♠♥♦♣]|[2-9AJQK][♠♥♦♣]|→|↔|←|↑|↓|✓|×|•|\+|=|×|\|)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${match.index}-${token}`;

    if (token.startsWith("[") && token.endsWith("]")) {
      const inner = token.slice(1, -1);
      if (inner.includes("|")) {
        parts.push(renderDominoToken(token, key));
      } else if (SUITS_SET.has(inner.slice(-1)) || /^[A-Z0-9\s♠♥♦♣]+$/.test(inner)) {
        parts.push(renderCardHand(inner, key));
      } else {
        parts.push(<span key={key} className="guide-badge">{token}</span>);
      }
    } else if (/^(10|[2-9AJQK])([♠♥♦♣])$/.test(token)) {
      parts.push(renderCardToken(token, key));
    } else if (["→", "↔", "←", "↑", "↓"].includes(token)) {
      parts.push(
        <span key={key} className="guide-arrow-badge" aria-hidden="true">
          {token}
        </span>,
      );
    } else if (["✓", "×"].includes(token)) {
      parts.push(
        <span
          key={key}
          className={`guide-status-mark mark-${token === "✓" ? "success" : "fail"}`}
        >
          {token}
        </span>,
      );
    } else if (["+", "=", "×", "|"].includes(token)) {
      parts.push(
        <span key={key} className="guide-operator">
          {token}
        </span>,
      );
    } else {
      parts.push(<span key={key}>{token}</span>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts;
}

export function GuideDiagram({ diagram }: GuideDiagramProps) {
  if (!diagram) return null;

  if (isChessGrid(diagram)) {
    return (
      <div className="guide-diagram guide-diagram-chess">
        {renderChessGrid(diagram)}
      </div>
    );
  }

  if (isWordlePattern(diagram)) {
    return (
      <div className="guide-diagram guide-diagram-wordle">
        {renderWordlePattern(diagram)}
      </div>
    );
  }

  const lines = diagram.split("\n");

  return (
    <div className="guide-diagram guide-diagram-formatted" role="img">
      {lines.map((line, idx) => (
        <div key={idx} className="guide-diagram-line">
          {renderLineTokens(line)}
        </div>
      ))}
    </div>
  );
}
