/**
 * Modular type scale (base 16px, ratio 1.25).
 * Prefer Tailwind classes (`text-caption`, `text-small`, `text-body`, ...).
 * These numeric values are for non-Tailwind contexts (Recharts ticks, inline SVG,
 * Google Maps labels, HTML emails).
 */
export const FONT_SIZE = {
  display: 61,
  h1: 49,
  h2: 39,
  h3: 31,
  h4: 25,
  bodyLg: 20,
  body: 16,
  small: 14,
  caption: 12,
} as const;

/** Font size for chart tick labels, axis labels, legends. */
export const CHART_TICK_FONT_SIZE = FONT_SIZE.caption;
