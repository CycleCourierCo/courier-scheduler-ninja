import { describe, it, expect } from "vitest";
import { snapBatches } from "../../../supabase/functions/_shared/snapBatch";

const pts = (n: number, start = 0, step = 120_000) => Array.from({ length: n }, (_, i) => ({ lat: i, lon: i, t: start + i * step }));

describe("snapBatches", () => {
  it("splits into batches of 100 with one point overlap", () => {
    const [seg] = snapBatches(pts(250));
    expect(seg.map((b) => b.length)).toEqual([100, 100, 52]);
    expect(seg[1][0]).toEqual(seg[0][99]);
  });
  it("breaks the line on gaps over 10 minutes", () => {
    const res = snapBatches([...pts(5), ...pts(5, 10_000_000)]);
    expect(res.length).toBe(2);
  });
});
