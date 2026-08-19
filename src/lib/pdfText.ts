import * as pdfjs from "pdfjs-dist";
// Vite resolves this to a hashed asset URL so the worker loads without a CDN.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Rebuilds text rows from positioned PDF glyph runs, preserving column gaps. */
export const buildLinesFromItems = (
  items: Array<{ str: string; x: number; y: number; width: number }>,
  yTolerance = 2
): string[] => {
  const rows: Array<{ y: number; items: typeof items }> = [];
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
    let cursor = 0;
    for (const item of sorted) {
      // ~2 units per character at the invoice font size; pad gaps so columns stay apart.
      const targetCol = Math.max(Math.round(item.x / 4.6), line.length ? cursor + 1 : 0);
      if (targetCol > line.length) line += " ".repeat(targetCol - line.length);
      line += item.str;
      cursor = line.length;
    }
    return line.replace(/\s+$/, "");
  });
};

/** Extracts layout-preserving text from a PDF file, page by page. */
export const extractPdfText = async (file: File | ArrayBuffer): Promise<string> => {
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item): item is typeof item & { str: string; transform: number[]; width: number } =>
        "str" in item
      )
      .map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
      }));
    pages.push(buildLinesFromItems(items).join("\n"));
  }
  await pdf.destroy();
  return pages.join("\n");
};
