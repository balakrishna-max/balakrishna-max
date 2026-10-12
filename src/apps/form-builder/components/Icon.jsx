import React from 'react';

const P = {
  heading: 'M6 4v16M18 4v16M6 12h12',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  short: 'M4 8h16v8H4zM8 11v2',
  long: 'M4 5h16v14H4zM7 9h10M7 12h10M7 15h6',
  para: 'M5 7h14M5 11h14M5 15h9',
  dropdown: 'M4 6h16v12H4zM13 11l2.5 2.5L18 11',
  radio: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  check: 'M4 4h16v16H4zM8 12l3 3 5-6',
  number: 'M9 4 7 20M17 4l-2 16M4 9h16M3 15h16',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5a1.5 1.5 0 1 0 0-.01',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  spinner: 'M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  bars: 'M5 20V13M10 20V9M15 20V5M20 20v-8',
  divider: 'M3 12h18',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  back: 'M15 18l-6-6 6-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  formula: 'M5 4h10M5 4v16M5 12h7M15 12l5 6M20 12l-5 6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  layout: 'M4 4h16v16H4zM12 4v16',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M10 5h8M6 19h8M14 5l-4 14',
  underline: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  sign: 'M3 17c2.5 0 3.5-7 6-7s1.5 7 4 7 2.5-4 4.5-4 2 2 3.5 2M3 21h18',
  api: 'M4 7h6v4H4zM14 13h6v4h-6zM10 9h2v6h2M7 11v6h7',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
};

export default function Icon({ name, size = 18, className = '', title }) {
  return (
    <svg
      className={`dfb-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={P[name] || P.short} />
    </svg>
  );
}
