export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/** Rebuilds text rows from positioned PDF glyph runs, preserving column gaps. */
export const buildLinesFromItems = (items: PdfTextItem[], yTolerance = 2): string[] => {
  const rows: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const item of items) {
    if (!item.str) continue;
    const row = rows.find((r) => Math.abs(r.y - item.y) <= yTolerance);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => {
    const sorted = [...row.items].sort((a, b) => a.x - b.x);
    let line = "";
    for (const item of sorted) {
      const targetCol = Math.max(Math.round(item.x / 4.6), line.length ? line.length + 1 : 0);
      if (targetCol > line.length) line += " ".repeat(targetCol - line.length);
      line += item.str;
    }
    return line.replace(/\s+$/, "");
  });
};
