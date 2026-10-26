// Pure helpers for road-snapping tracker paths (no imports so Vitest can test it).
export interface SnapPt { lat: number; lon: number; t: number }

export const SNAP_BATCH = 100;
export const SNAP_GAP_MS = 10 * 60_000;

/** Split into continuous segments (break on gaps over 10 min), then into Roads API batches
 *  of at most 100 points, each batch after the first repeating the previous batch's last point. */
export function snapBatches(points: SnapPt[], size = SNAP_BATCH, gapMs = SNAP_GAP_MS): SnapPt[][][] {
  const segments: SnapPt[][] = [];
  let cur: SnapPt[] = [];
  for (const p of points) {
    if (cur.length && p.t - cur[cur.length - 1].t > gapMs) { segments.push(cur); cur = []; }
    cur.push(p);
  }
  if (cur.length) segments.push(cur);
  return segments.filter((s) => s.length > 1).map((seg) => {
    const out: SnapPt[][] = [];
    for (let i = 0; i < seg.length - 1; i += size - 1) out.push(seg.slice(i, i + size));
    return out;
  });
}
