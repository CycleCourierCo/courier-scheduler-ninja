import qrcode from "qrcode-generator";
import { bayQrText } from "@/lib/labelScan";

const svgFor = (text: string) => { const c = qrcode(0, "M"); c.addData(text); c.make(); return c.createSvgTag({ cellSize: 8, margin: 4, scalable: true }); };
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));

/** Opens a print window with 4x6in thermal labels: one for the bay, optionally one per slot. */
export function printBayQrLabels(bay: string, slots: number, includeSlots: boolean) {
  const pages = [{ text: bayQrText(bay), title: `BAY ${bay}`, sub: "Scan to allocate to this bay" }];
  if (includeSlots) for (let i = 1; i <= slots; i++) pages.push({ text: bayQrText(bay, i), title: `${bay}-${i}`, sub: `Bay ${bay} · slot ${i}` });
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><title>Bay ${esc(bay)} QR labels</title><style>
@page{size:4in 6in;margin:0}body{margin:0;font-family:Arial,sans-serif;color:#000;background:#fff}
.p{width:4in;height:6in;box-sizing:border-box;padding:.3in;display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-after:always;text-align:center}
.p svg{width:3.2in;height:3.2in}h1{font-size:72px;margin:.15in 0 0;line-height:1}p{font-size:16px;margin:.08in 0 0}
</style></head><body>${pages.map((p) => `<div class="p">${svgFor(p.text)}<h1>${esc(p.title)}</h1><p>${esc(p.sub)}</p></div>`).join("")}
<script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
  return true;
}
