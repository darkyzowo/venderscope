import { useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * PageBackground — three large radial-gradient orbs that drift across the
 * viewport as a subtle ambient background effect.
 *
 * Positions and drift keyframes are randomised on every mount, so each
 * page load and every navigation to a new route yields a unique layout.
 * The CSS classes carry visual properties only (size, colour, z-index);
 * position and animation are applied as inline styles here.
 */
export default function PageBackground() {
  const [orbs] = useState(() => {
    const rand   = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
    const drift  = () => ['pg-drift-a', 'pg-drift-b', 'pg-drift-c'][rand(0, 2)]

    return [
      // Orb A — bleeds in from a random top-left position
      {
        cls: 'page-glow-a',
        style: {
          top:       `${rand(-480, -160)}px`,
          left:      `${rand(-440, -100)}px`,
          animation: `${drift()} ${rand(44, 62)}s ease-in-out infinite`,
        },
      },
      // Orb B — bleeds in from a random bottom-right position
      {
        cls: 'page-glow-b',
        style: {
          bottom: `${rand(-480, -160)}px`,
          right:  `${rand(-440, -100)}px`,
          animation: `${drift()} ${rand(56, 76)}s ease-in-out infinite`,
        },
      },
      // Orb C — floats somewhere across the mid-viewport
      {
        cls: 'page-glow-c',
        style: {
          top:       `${rand(10, 62)}%`,
          left:      `${rand(28, 74)}%`,
          animation: `${drift()} ${rand(66, 92)}s ease-in-out infinite`,
        },
      },
    ]
  }) // computed once per mount, new values on every navigation

  return createPortal(
    <>
      {orbs.map(({ cls, style }, i) => (
        <div key={i} className={`page-glow ${cls}`} style={style} aria-hidden="true" />
      ))}
    </>,
    document.body
  )
}
