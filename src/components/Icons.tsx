interface IconProps {
  size?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function IconPractice({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v15H5.5A1.5 1.5 0 0 1 4 17.5z" />
      <path d="M10 4h8.5A1.5 1.5 0 0 1 20 5.5v12a1.5 1.5 0 0 1-1.5 1.5H10" />
      <path d="M13.5 9h3.5" />
      <path d="M13.5 13h3.5" />
    </svg>
  );
}

/** 今日：日历 + 勾选 */
export function IconToday({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3.6" y="5.2" width="16.8" height="15" rx="2.4" />
      <path d="M3.6 9.6h16.8" />
      <path d="M8.4 3.4v3.4M15.6 3.4v3.4" />
      <path d="m9 14.6 2 2 3.8-3.8" />
    </svg>
  );
}

/** 考点：标签 */
export function IconTopic({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M11.2 3.6H5.4A1.8 1.8 0 0 0 3.6 5.4v5.8c0 .5.2.9.5 1.3l7.4 7.4a1.8 1.8 0 0 0 2.5 0l5.8-5.8a1.8 1.8 0 0 0 0-2.5L12.5 4.1a1.8 1.8 0 0 0-1.3-.5z" />
      <circle cx="7.9" cy="7.9" r="1.3" />
    </svg>
  );
}

export function IconWrong({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4v4.5h4.5" />
      <path d="M12 8.2v4.4" />
      <path d="M12 15.6v.6" />
    </svg>
  );
}

export function IconStats({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 20h16" />
      <rect x="5" y="12" width="3.4" height="5.5" rx="1" />
      <rect x="10.3" y="7" width="3.4" height="10.5" rx="1" />
      <rect x="15.6" y="10" width="3.4" height="7.5" rx="1" />
    </svg>
  );
}

export function IconSettings({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-2.6-1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1-2.6H4a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 2.6-1V4a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1 2.6h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.3.9z" />
    </svg>
  );
}

export function IconBack({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={2.1}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

export function IconStar({ size = 20, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} fill={filled ? 'currentColor' : 'none'}>
      <path d="m12 3.8 2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.6-5 2.6 1-5.6-4.1-4 5.6-.8z" />
    </svg>
  );
}

export function IconClock({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M12 7.6V12l3 1.8" />
    </svg>
  );
}

export function IconClose({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={2.1}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconCheck({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={2.2}>
      <path d="m5 12.8 4.6 4.4L19 6.6" />
    </svg>
  );
}
