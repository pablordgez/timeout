import type { ReactNode } from "react";

/** Small silhouettes drawn in the same style, independent of installed fonts. */
export function GameIcon({
  id,
  fallback = "?",
}: {
  id: string;
  fallback?: string;
}) {
  const artwork: Record<string, ReactNode> = {
    snake: (
      <>
        <path
          d="M7 25h9V13h13V7h-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="23" cy="6" r="1" fill="var(--raised)" />
        <circle cx="7" cy="8" r="3" fill="var(--accent)" />
      </>
    ),
    runner: (
      <>
        <path
          d="M21 4h11v10h-8v3h5v3h-3v-1h-3v5h-3v5h4v3h-7v-7h-3v4h-3v3H7v-4h4v-6l-5-4-3-7v-3l5 6 5 2h4v-4h4z"
          fill="currentColor"
        />
        <rect x="25" y="6" width="2" height="2" fill="var(--raised)" />
      </>
    ),
    flappy: (
      <>
        <path
          d="M4 3h5v8H4zm0 20h5v8H4zm24-20h5v8h-5zm0 20h5v8h-5z"
          fill="currentColor"
          opacity=".45"
        />
        <path
          d="M10 18c0-5 3-8 7-8s7 3 7 7l5 2-5 2c-1 3-4 5-7 5-4 0-7-3-7-8z"
          fill="currentColor"
        />
        <path d="m11 17 7 3-4 3" fill="var(--accent)" />
        <circle cx="21" cy="15" r="1.4" fill="var(--raised)" />
      </>
    ),
    breakout: (
      <>
        <path
          d="M3 4h8v5H3zm11 0h8v5h-8zm11 0h8v5h-8zM3 12h8v5H3zm11 0h8v5h-8z"
          fill="currentColor"
        />
        <circle cx="26" cy="21" r="3" fill="var(--accent)" />
        <path d="m25 24-5 5" stroke="currentColor" strokeWidth="1.5" />
        <rect
          x="12"
          y="30"
          width="16"
          height="3"
          rx="1.5"
          fill="currentColor"
        />
      </>
    ),
    blocks: (
      <>
        <path
          d="M12 3h5v5h-5zm6 0h5v5h-5zm6 0h5v5h-5zm-6 6h5v5h-5z"
          fill="var(--accent)"
        />
        <path
          d="M3 21h5v5H3zm0 6h5v5H3zm6 0h5v5H9zm6 0h5v5h-5zm6-6h5v5h-5zm6 0h5v5h-5zm-6 6h5v5h-5zm6 0h5v5h-5z"
          fill="currentColor"
        />
      </>
    ),
  };
  return artwork[id] ? (
    <svg
      viewBox="0 0 36 36"
      width="36"
      height="36"
      aria-hidden="true"
      focusable="false"
    >
      {artwork[id]}
    </svg>
  ) : (
    <span aria-hidden="true">{fallback}</span>
  );
}
