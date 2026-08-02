// Small hand-rolled inline SVG icon set for the admin shell — kept dependency-free
// (no icon library installed) rather than pulling one in for ~15 glyphs.

import type { ReactNode } from "react";

type IconProps = { className?: string };

function base(paths: ReactNode) {
  return function Icon({ className }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

export const SparkIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" fill="currentColor" />
  </svg>
);

export const DashboardIcon = base(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>,
);

export const BuildingIcon = base(
  <>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" />
  </>,
);

export const BookIcon = base(
  <>
    <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 15.5v-10z" />
    <path d="M4 15.5A2.5 2.5 0 016.5 13H20v6H6.5A2.5 2.5 0 014 16.5" />
  </>,
);

export const HubIcon = base(
  <>
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="5" cy="19" r="2.2" />
    <circle cx="19" cy="19" r="2.2" />
    <path d="M12 7.2V13M12 13L6.6 17.2M12 13l5.4 4.2" />
  </>,
);

export const ChatIcon = base(
  <path d="M4 5h16v11H8l-4 4V5z" />,
);

export const LeadsIcon = base(
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0111 0" />
    <circle cx="18" cy="7" r="2" />
    <path d="M15.5 20a3.4 3.4 0 016.5-1.3" />
  </>,
);

export const ChartIcon = base(
  <>
    <path d="M4 20V10M11 20V4M18 20v-7" />
    <path d="M2.5 20h19" />
  </>,
);

export const BellIcon = base(
  <>
    <path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9z" />
    <path d="M10 19a2 2 0 004 0" />
  </>,
);

export const PaletteIcon = base(
  <>
    <path d="M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.2 0-.9.7-1.5 1.5-1.5H16a4 4 0 004-4c0-4.4-3.6-8-8-8z" />
    <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
    <circle cx="10.5" cy="7" r="1" fill="currentColor" />
    <circle cx="15" cy="7.5" r="1" fill="currentColor" />
  </>,
);

export const SlidersIcon = base(
  <>
    <path d="M4 6h10M17 6h3M4 12h3M9 12h11M4 18h14M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="6" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </>,
);

export const PlugIcon = base(
  <>
    <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0V8z" />
    <path d="M12 17v4" />
  </>,
);

export const CardIcon = base(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
  </>,
);

export const UsersIcon = base(
  <>
    <circle cx="8.5" cy="8" r="3" />
    <path d="M2.5 20a6 6 0 0112 0" />
    <circle cx="17" cy="8" r="2.4" />
    <path d="M14.5 20a4.2 4.2 0 018.5-1" />
  </>,
);

export const ArrowRightIcon = base(<path d="M5 12h14M13 6l6 6-6 6" />);

export const LogoutIcon = base(
  <>
    <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </>,
);

export const PlusIcon = base(<path d="M12 5v14M5 12h14" />);

export const AlertIcon = base(
  <>
    <path d="M12 3L2 20h20L12 3z" />
    <path d="M12 10v4M12 17h0" />
  </>,
);

export const CheckIcon = base(<path d="M4 12l5 5L20 6" />);

export const SearchIcon = base(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </>,
);
