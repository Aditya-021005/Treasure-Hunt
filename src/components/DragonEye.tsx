/**
 * The mark: a drake's eye, lit from inside.
 *
 * Pure SVG so it stays crisp at any size and costs nothing to load. The
 * gradient ids are suffixed with `variant` because two of these render on
 * the same page and duplicate ids would make one steal the other's fill.
 */
export default function DragonEye({
  className = "",
  variant = "a",
  title,
}: {
  className?: string;
  /** Unique per instance on a page — see the note above. */
  variant?: string;
  title?: string;
}) {
  const iris = `de-iris-${variant}`;
  const burn = `de-burn-${variant}`;

  return (
    <svg
      viewBox="0 0 120 80"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <radialGradient id={iris} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff2cf" />
          <stop offset="32%" stopColor="#ffb43c" />
          <stop offset="70%" stopColor="#ff6a15" />
          <stop offset="100%" stopColor="#7a1d05" />
        </radialGradient>
        <radialGradient id={burn} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8a2b" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff5a00" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* heat coming off it */}
      <ellipse cx="60" cy="40" rx="58" ry="34" fill={`url(#${burn})`} />

      {/* the lid — two sweeps meeting in points, as a reptile's does */}
      <path
        d="M6 40C24 12 44 4 60 4c16 0 36 8 54 36-18 28-38 36-54 36C44 76 24 68 6 40Z"
        fill="#0b0607"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      <circle cx="60" cy="40" r="24" fill={`url(#${iris})`} />

      {/* slit */}
      <ellipse cx="60" cy="40" rx="5" ry="21" fill="#12060a" />
      <ellipse cx="60" cy="40" rx="2" ry="15" fill="#000" opacity="0.85" />

      {/* a wet highlight, so it reads as an eye and not a logo */}
      <ellipse cx="50" cy="28" rx="7" ry="4.5" fill="#fff6e2" opacity="0.5" transform="rotate(-28 50 28)" />

      {/* brow scales */}
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.65">
        <path d="M14 27c8-9 18-15 27-18" />
        <path d="M106 27c-8-9-18-15-27-18" />
        <path d="M20 55c8 8 17 13 25 16" />
        <path d="M100 55c-8 8-17 13-25 16" />
      </g>
    </svg>
  );
}
