// Typography system — single source of truth for type styles across the site.
//
// Three orthogonal scales: SIZE, TRACKING, WEIGHT.
//
// Rules of thumb when using these:
// - Pair `size.X` with `tracking.normal` for default body/meta text.
// - For uppercase labels, use `tracking.label` (slightly looser) so letters
//   don't crash together. Don't use negative tracking on uppercase.
// - For display/title sizes (24px+), use `tracking.tight`.
// - Weights stay light by default — only `medium` for titles and emphasis.
// - Font family is always Geist; the global font from app/layout.tsx applies
//   to <body>, so styles below just inherit it. The `family` constant exists
//   only for places that need to set it explicitly (e.g. inside `style={...}`
//   on a button that would otherwise inherit a different family).

export const family = '"Geist", system-ui, sans-serif';

export const size = {
  caption: 10, // chips, tiny labels, photo counts
  meta: 12,    // labels, values, small UI text — the workhorse
  body: 14,    // running text, descriptions
  subtitle: 18,// section headers
  title: 24,   // lightbox titles, hero titles
  display: 36, // page hero numbers (collection count)
} as const;

export const tracking = {
  tight: "-0.04em", // display / title sizes (≥ 24px)
  normal: "-0.02em",// body & meta — default for most text
  label: "0",       // small uppercase labels (so letters don't crash)
  loose: "0.04em",  // chips, tags — small uppercase with airier feel
} as const;

export const weight = {
  regular: 400, // body, captions, labels, values — the default
  medium: 500,  // titles, mild emphasis
} as const;

// Convenient line-height pairings — keyed to size so line-height stays in
// proportion. Use these instead of guessing `lineHeight` per element.
export const leading = {
  caption: "14px", // size.caption
  meta: "16px",    // size.meta
  body: "20px",    // size.body — relaxed for reading
  subtitle: "24px",// size.subtitle
  title: "28px",   // size.title
  display: "40px", // size.display
} as const;
