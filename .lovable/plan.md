
## Type scale (base 16px, ratio 1.25 major-third)

| Tier | rem | px | Line-height | Weight guidance | Role |
|---|---|---|---|---|---|
| `text-display` | 3.815rem | 61px | 1.05 | 700 | Marketing hero only |
| `text-h1` | 3.052rem | 49px | 1.1 | 700 | Page title (one per view) |
| `text-h2` | 2.441rem | 39px | 1.15 | 700 | Major section header |
| `text-h3` | 1.953rem | 31px | 1.2 | 600 | Card/panel title, dialog title |
| `text-h4` | 1.563rem | 25px | 1.25 | 600 | Sub-section, list group title |
| `text-body-lg` | 1.25rem | 20px | 1.5 | 400 | Lead paragraphs, empty-state copy |
| `text-body` | 1rem | 16px | 1.55 | 400 | Default body text, inputs, buttons |
| `text-small` | 0.875rem | 14px | 1.45 | 400 | Table cells, secondary labels, form help |
| `text-caption` | 0.75rem | 12px | 1.4 | 500 | Badges, timestamps, chart ticks, meta |

Reasoning: strict 1.25 anchored at 16px body. `caption` sits one step below `small` (12 vs 14) as the smallest legible tier — this absorbs today's ad-hoc `text-[10px]`, `text-[11px]`, `text-[0.8rem]`, and `fontSize={10|11|12}`. Nothing smaller than 12px is retained (a11y minimum).

## Mapping from current usage → new tier

| Today | New tier |
|---|---|
| text-[10px], text-[11px], text-[0.8rem], text-xs, `fontSize={10\|11\|12}` | `text-caption` |
| text-sm | `text-small` |
| text-base | `text-body` |
| text-lg | `text-body-lg` |
| text-xl | `text-h4` |
| text-2xl | `text-h3` |
| text-3xl | `text-h2` |
| text-4xl, text-5xl | `text-h1` |
| text-6xl, text-7xl, text-8xl | `text-display` |

Net distinct sizes: **14 → 9** (5 eliminated: `[10px]`, `[11px]`, `[0.8rem]`, and two of the oversized `5xl/6xl/7xl/8xl` collapse into `display`/`h1`).

## Implementation

1. **Register the scale** in `tailwind.config.ts` under `theme.extend.fontSize`, each entry as `[size, { lineHeight, fontWeight }]`. Also register the raw px values as CSS variables in `src/index.css` (`--fs-display` … `--fs-caption`) so charts and inline styles can reference them.
2. **Keep legacy classes working temporarily** — do not remove Tailwind's default `fontSize` map; the new names are additive. This lets the refactor land incrementally without breaking anything.
3. **Codemod pass** — sed/script across `src/**/*.{ts,tsx}` applying the mapping table above. Manual review only for the ~10 hero/marketing files that used `text-5xl+`, to decide `h1` vs `display`.
4. **Charts** — replace inline `fontSize={12|11|10}` in `src/components/analytics/*.tsx` and `src/components/scheduling/ClusterMap.tsx`, `src/pages/DispatchRoutesPage.tsx` with `fontSize={12}` sourced from a shared `CHART_TICK_FONT_SIZE` constant equal to the caption tier.
5. **Email templates** (`src/utils/announcementEmailTemplate.ts`) — inline `font-size:11/13/15/20/22px` → snap to nearest tier px (12, 14, 16, 20, 25). Emails stay inline-styled but use scale values.
6. **shadcn components** — audit `button.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `dialog.tsx`, `card.tsx`, `alert.tsx`, `table.tsx`, `tabs.tsx`, `toast/sonner`. Where they hardcode `text-sm`/`text-xs`, switch to the semantic tier (`text-small`, `text-caption`) so variants are consistent.
7. **Report** — after the pass, re-run the ripgrep tally and print a before/after diff of distinct sizes + counts per file bucket.

## Out of scope

- Font family, weight system, and color tokens (already defined).
- Responsive size overrides (e.g. `md:text-h1`) — kept as-is where already used.
- No business-logic or copy changes.
