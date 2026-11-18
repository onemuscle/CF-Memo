/** 線のアイコン (24×24・stroke)。記録の種類ごとに固定 */
const PATHS: Record<string, JSX.Element> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  chart: <path d="M4 20V11M10 20V4M16 20v-6M22 20H2" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  // 記録の種類
  workouts: <path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.7 1.6-3.6C10 9.5 11 8 12 3zM12 21a6 6 0 0 0 6-6" />,
  strength_sets: <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />,
  skill_logs: (
    <>
      <circle cx="7" cy="16" r="3.5" />
      <circle cx="17" cy="16" r="3.5" />
      <path d="M7 12.5V3M17 12.5V3" />
    </>
  ),
  cardio_sessions: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  races: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  body_metrics: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8.5 9.5a5 5 0 0 1 7 0L13 12" />
    </>
  ),
  nutrition_entries: <path d="M3 11h18a9 9 0 0 1-18 0zM7 7c0-2 2-2 2-4M12 7c0-2 2-2 2-4M17 7c0-2 2-2 2-4" />,
  nutrition_targets: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 12 20 4M15 4h5v5" />
    </>
  ),
  supplements: (
    <>
      <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="m8.5 8.5 7 7" />
    </>
  ),
  sleep_logs: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  wellness: <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8zM3.5 12h4l1.5-3 3 6 1.5-3h4" />,
  injuries: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  daily_health: (
    <>
      <rect x="6" y="5" width="12" height="14" rx="3" />
      <path d="M9 5V2h6v3M9 19v3h6v-3M9 12h1.5l1-2 1.5 4 1-2H15" />
    </>
  ),
  goals: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  journal: <path d="M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4" />,
  reports: <path d="M5 3h10l4 4v14H5zM9 17v-3M12 17v-6M15 17v-4" />,
}

export default function Icon({ name, size = 22, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name] ?? PATHS.journal}
    </svg>
  )
}
