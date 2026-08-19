import * as pdfjs from "pdfjs-dist";
// Vite resolves this to a hashed asset URL so the worker loads without a CDN.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { buildLinesFromItems, type PdfTextItem } from "@/lib/pdfLines";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Maps a glyph run's transform into reading space (x = along the line, y = up the page).
 * WEX invoices are landscape pages with 90-degree rotated text, so the raw
 * transform axes are swapped compared with an upright page.
 */
export const toReadingSpace = (transform: number[]): { x: number; y: number } => {
  const [a, b, , , e, f] = transform;
  const rotated = Math.abs(a) < Math.abs(b);
  return rotated ? { x: f, y: -e } : { x: e, y: f };
};

/** Extracts layout-preserving text from a PDF file, page by page. */
export const extractPdfText = async (file: File | ArrayBuffer): Promise<string> => {
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = content.items
      .filter((item): item is typeof item & { str: string; transform: number[]; width: number } =>
        "str" in item
      )
      .map((item) => ({
        str: item.str,
        ...toReadingSpace(item.transform),
        width: item.width,
      }));
    pages.push(buildLinesFromItems(items).join("\n"));
  }
  pdf.cleanup();
  return pages.join("\n");
};

export { buildLinesFromItems };
