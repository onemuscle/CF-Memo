interface P {
  size?: number
}

const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const BackIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

export const PlayIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </svg>
)

export const PauseIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M8 5v14M16 5v14" />
  </svg>
)

export const ShuffleIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
)

export const ShareIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 3v13M7 8l5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
)

export const TimerIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5M9 2h6" />
  </svg>
)

export const SwapIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
  </svg>
)

export const VideoIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="2" y="5" width="15" height="14" rx="2" />
    <path d="m17 10 5-3v10l-5-3" />
  </svg>
)

export const ChevronIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const CalendarIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </svg>
)

export const CloseIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const CheckIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="m5 12 5 5L20 7" />
  </svg>
)

export const FlameIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 22c4 0 7-2.7 7-7 0-4-3-6-4-9-1 2-2 3-3.5 3.5C11 7 10 4 9 2 8 6 5 9 5 15c0 4.3 3 7 7 7z" />
  </svg>
)

export const SkipIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 4l10 8-10 8zM19 5v14" />
  </svg>
)

export const LinkIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
)

export const ImageIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-5-5L5 21" />
  </svg>
)
