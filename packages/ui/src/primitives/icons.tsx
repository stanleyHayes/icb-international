import { createGlyph } from './icon';

/**
 * The ICB core glyph set — the ~24 icons a banking UI needs everywhere.
 *
 * All glyphs share the 24×24 grid, 1.5 stroke, and round caps from `icon.tsx`. Draw them by
 * silhouette, not by metaphor stacking: one idea per icon, recognisable at 16px. Add a glyph by
 * appending one `createGlyph` call here and one export line to `src/index.ts`.
 */

export const IconAccounts = createGlyph(
  'IconAccounts',
  <>
    <path d="M5.5 8.5h13a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2z" />
    <path d="M6 8.5V7a2 2 0 0 1 2-2h9.5" />
    <path d="M16.5 14.25h.01" />
  </>,
);

export const IconCards = createGlyph(
  'IconCards',
  <>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3 9.5h18" />
    <path d="M7 14.5h4" />
  </>,
);

export const IconTransfers = createGlyph(
  'IconTransfers',
  <>
    <path d="M4 8h13.5" />
    <path d="M14.5 4.5 18 8l-3.5 3.5" />
    <path d="M20 16H6.5" />
    <path d="M9.5 12.5 6 16l3.5 3.5" />
  </>,
);

export const IconPayments = createGlyph(
  'IconPayments',
  <>
    <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
    <circle cx="12" cy="12" r="2.75" />
    <path d="M6 10v4M18 10v4" />
  </>,
);

export const IconLoans = createGlyph(
  'IconLoans',
  <>
    <circle cx="7.25" cy="7.25" r="2.75" />
    <circle cx="16.75" cy="16.75" r="2.75" />
    <path d="M18.5 5.5 5.5 18.5" />
  </>,
);

export const IconSavings = createGlyph(
  'IconSavings',
  <>
    <circle cx="9.5" cy="9.5" r="6" />
    <path d="M14.86 6.64a6 6 0 1 1-8.22 8.22" />
  </>,
);

export const IconChart = createGlyph(
  'IconChart',
  <>
    <path d="M4 4v15a1 1 0 0 0 1 1h15" />
    <path d="M8.5 16v-5" />
    <path d="M12.5 16V7.5" />
    <path d="M16.5 16v-3" />
  </>,
);

export const IconAlert = createGlyph(
  'IconAlert',
  <>
    <path d="M12 4.5 21 19.5H3L12 4.5z" />
    <path d="M12 10v4" />
    <path d="M12 16.75h.01" />
  </>,
);

export const IconCheck = createGlyph('IconCheck', <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />);

export const IconClose = createGlyph(
  'IconClose',
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </>,
);

export const IconChevronDown = createGlyph('IconChevronDown', <path d="M6 9.5l6 6 6-6" />);

export const IconChevronUp = createGlyph('IconChevronUp', <path d="M6 14.5l6-6 6 6" />);

export const IconChevronLeft = createGlyph('IconChevronLeft', <path d="M14.5 6l-6 6 6 6" />);

export const IconChevronRight = createGlyph('IconChevronRight', <path d="M9.5 6l6 6-6 6" />);

export const IconSearch = createGlyph(
  'IconSearch',
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.4-4.4" />
  </>,
);

export const IconFilter = createGlyph(
  'IconFilter',
  <path d="M4 5.5h16l-6.25 7.1V19l-3.5-2.25v-4.15L4 5.5z" />,
);

export const IconDownload = createGlyph(
  'IconDownload',
  <>
    <path d="M12 4v10.5" />
    <path d="M7.5 10.25 12 14.75l4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </>,
);

export const IconPlus = createGlyph(
  'IconPlus',
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);

export const IconUser = createGlyph(
  'IconUser',
  <>
    <circle cx="12" cy="8.25" r="3.75" />
    <path d="M4.75 19.5a7.25 7.25 0 0 1 14.5 0" />
  </>,
);

export const IconLock = createGlyph(
  'IconLock',
  <>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    <path d="M12 14.75h.01" />
  </>,
);

export const IconEye = createGlyph(
  'IconEye',
  <>
    <path d="M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const IconEyeOff = createGlyph(
  'IconEyeOff',
  <>
    <path d="M9.88 5.9A9.6 9.6 0 0 1 12 5.75c6 0 9.5 6.25 9.5 6.25a17.6 17.6 0 0 1-2.06 2.85" />
    <path d="M6.62 6.62A16.9 16.9 0 0 0 2.5 12s3.5 6.25 9.5 6.25a9.4 9.4 0 0 0 3.32-.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M4 4l16 16" />
  </>,
);

export const IconMenu = createGlyph(
  'IconMenu',
  <>
    <path d="M4 6.5h16" />
    <path d="M4 12h16" />
    <path d="M4 17.5h16" />
  </>,
);

export const IconLogout = createGlyph(
  'IconLogout',
  <>
    <path d="M13.5 8V6.5a2 2 0 0 0-2-2h-5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V16" />
    <path d="M9.5 12H21" />
    <path d="M17.75 8.75 21 12l-3.25 3.25" />
  </>,
);
