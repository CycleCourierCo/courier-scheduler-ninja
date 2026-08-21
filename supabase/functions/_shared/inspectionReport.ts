// Builds and stores the printable PDI inspection report PDF.
// Deliberately contains NO pricing information — description + decision only.
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const BUCKET = "inspection-reports";
// Long-lived signed link (bucket is private) — ~10 years.
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export type ReportIssue = {
  issue_description: string | null;
  part_name?: string | null;
  part_number?: string | null;
  status?: string | null;
  resolved_at?: string | null;
  customer_responded_at?: string | null;
};

const londonDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Europe/London",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

export const issueDecisionLabel = (issue: ReportIssue): string => {
  const status = (issue.status || "pending").toLowerCase();
  if (status === "repaired" || status === "resolved") return "Completed";
  if (status === "approved") return "Approved";
  if (status === "declined") return "Declined";
  return "Pending";
};

type ParsedItem = { result: string; label: string; comment: string };
type ParsedSection = { title: string; items: ParsedItem[] };

// Reverses the notes format written by the PDI form:
//   "— Section title —" then "PASS  Item label: optional comment"
export const parsePdiNotes = (notes?: string | null) => {
  const sections: ParsedSection[] = [];
  const general: string[] = [];
  const lines = (notes || "").split("\n");
  let current: ParsedSection | null = null;
  let inGeneral = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const sectionMatch = line.match(/^[—-]\s*(.+?)\s*[—-]$/);
    if (sectionMatch) {
      inGeneral = false;
      current = { title: sectionMatch[1], items: [] };
      sections.push(current);
      continue;
    }
    if (/^notes:/i.test(line)) {
      inGeneral = true;
      general.push(line.replace(/^notes:\s*/i, ""));
      continue;
    }
    const itemMatch = line.match(/^(PASS|ADVISORY|FAIL)\s+(.*)$/i);
    if (itemMatch && current) {
      const rest = itemMatch[2];
      const sep = rest.indexOf(":");
      sections.push; // no-op keeps tree-shakers honest
      current.items.push({
        result: itemMatch[1].toUpperCase(),
        label: sep >= 0 ? rest.slice(0, sep).trim() : rest.trim(),
        comment: sep >= 0 ? rest.slice(sep + 1).trim() : "",
      });
      continue;
    }
    if (inGeneral) general.push(line);
  }

  return { sections, general: general.join(" ").trim() };
};

export type ReportContext = {
  order: Record<string, any>;
  inspection: Record<string, any>;
  issues: ReportIssue[];
};

export const buildInspectionReportPdf = ({ order, inspection, issues }: ReportContext): Uint8Array => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - 20) return;
    doc.addPage();
    y = margin;
  };

  const sender = (order.sender || {}) as Record<string, any>;
  const receiver = (order.receiver || {}) as Record<string, any>;
  const bike = [order.bike_brand, order.bike_model].filter(Boolean).join(" ") || "Bike";

  // --- Header ---
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("CCC - Cycle Courier Co.", margin, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Pre-delivery inspection report", margin, 18);
  doc.setFontSize(10);
  doc.text(`Job #${order.tracking_number || "—"}`, pageWidth - margin, 14, { align: "right" });
  doc.setTextColor(31, 41, 55);
  y = 32;

  // --- Details block ---
  const details: [string, string][] = [
    ["Bike", bike],
    ["Type", order.bike_type || inspection.bike_type || "—"],
    ["Quantity", String(order.bike_quantity || 1)],
    ["Sender", sender.name || "—"],
    ["Receiver", receiver.name || "—"],
    ["Inspected by", inspection.inspected_by_name || "—"],
    ["Inspected at", londonDateTime(inspection.inspected_at)],
    ["Stage", String(inspection.status || "—").replace(/_/g, " ")],
  ];

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  const detailRows = Math.ceil(details.length / 2);
  const detailBlockHeight = detailRows * 6 + 6;
  doc.rect(margin, y, contentWidth, detailBlockHeight, "FD");
  doc.setFontSize(9);
  details.forEach(([label, value], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = margin + 4 + col * (contentWidth / 2);
    const lineY = y + 7 + row * 6;
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, x, lineY);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(String(value), contentWidth / 2 - 30)[0] || "—", x + 24, lineY);
  });
  y += detailBlockHeight + 8;

  // --- PDI checklist ---
  const { sections, general } = parsePdiNotes(inspection.notes);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Inspection checklist", margin, y);
  y += 6;

  if (sections.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const fallback = (inspection.notes || "No checklist was recorded for this inspection.").toString();
    const lines = doc.splitTextToSize(fallback, contentWidth);
    lines.forEach((line: string) => {
      ensureSpace(6);
      doc.text(line, margin, y);
      y += 5;
    });
    y += 4;
  } else {
    sections.forEach((section) => {
      ensureSpace(14);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(section.title, margin + 3, y + 5);
      y += 9;

      section.items.forEach((item) => {
        ensureSpace(8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        if (item.result === "PASS") doc.setTextColor(21, 128, 61);
        else if (item.result === "ADVISORY") doc.setTextColor(180, 83, 9);
        else doc.setTextColor(185, 28, 28);
        doc.text(item.result, margin + 3, y);
        doc.setTextColor(31, 41, 55);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const text = item.comment ? `${item.label} — ${item.comment}` : item.label;
        const lines = doc.splitTextToSize(text, contentWidth - 28);
        lines.forEach((line: string, i: number) => {
          if (i > 0) ensureSpace(5);
          doc.text(line, margin + 24, y);
          y += 4.6;
        });
        y += 0.8;
      });
      y += 3;
    });
  }

  if (general) {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("General notes", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.splitTextToSize(general, contentWidth).forEach((line: string) => {
      ensureSpace(6);
      doc.text(line, margin, y);
      y += 4.6;
    });
    y += 4;
  }

  // --- Issues ---
  ensureSpace(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Work identified", margin, y);
  y += 6;

  if (!issues.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("No work was identified during this inspection.", margin, y);
    y += 6;
  } else {
    const decisionX = pageWidth - margin - 26;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, contentWidth, 7, "F");
    doc.text("Item", margin + 3, y + 1);
    doc.text("Decision", decisionX, y + 1);
    y += 8;

    issues.forEach((issue) => {
      ensureSpace(10);
      const decision = issueDecisionLabel(issue);
      const partBits = [issue.part_name, issue.part_number].filter(Boolean).join(" / ");
      const description = issue.issue_description || "Repair";
      const lines = doc.splitTextToSize(description, contentWidth - 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const startY = y;
      lines.forEach((line: string, i: number) => {
        if (i > 0) ensureSpace(5);
        doc.text(line, margin + 3, y);
        y += 4.6;
      });
      if (partBits) {
        ensureSpace(5);
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(`Part: ${partBits}`, margin + 3, y);
        doc.setTextColor(31, 41, 55);
        y += 4.4;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      if (decision === "Completed" || decision === "Approved") doc.setTextColor(21, 128, 61);
      else if (decision === "Declined") doc.setTextColor(185, 28, 28);
      else doc.setTextColor(180, 83, 9);
      doc.text(decision, decisionX, startY);
      doc.setTextColor(31, 41, 55);
      doc.setDrawColor(233, 236, 241);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    });
  }

  // --- Footer on every page ---
  const pages = (doc as any).getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `Generated ${londonDateTime(new Date().toISOString())} · Cycle Courier Co. Ltd · No pricing shown on this report`,
      margin,
      pageHeight - 10
    );
    doc.text(`Page ${p} of ${pages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
};

// Regenerates and stores the report for an inspection. Returns the signed URL.
export const regenerateInspectionReport = async (
  admin: any,
  inspectionId: string
): Promise<{ url: string | null; orderId: string | null }> => {
  const { data: inspection, error: inspError } = await admin
    .from("bicycle_inspections")
    .select("*")
    .eq("id", inspectionId)
    .maybeSingle();
  if (inspError) throw inspError;
  if (!inspection) throw new Error("Inspection not found");

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, tracking_number, bike_brand, bike_model, bike_type, bike_quantity, sender, receiver, user_id")
    .eq("id", inspection.order_id)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new Error("Order not found");

  const { data: issues, error: issuesError } = await admin
    .from("inspection_issues")
    .select("issue_description, part_name, part_number, status, resolved_at, customer_responded_at, created_at")
    .eq("inspection_id", inspectionId)
    .order("created_at", { ascending: true });
  if (issuesError) throw issuesError;

  const bytes = buildInspectionReportPdf({
    order,
    inspection,
    issues: (issues || []) as ReportIssue[],
  });

  const path = `${order.id}.pdf`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signError) throw signError;

  const url = signed?.signedUrl || null;
  const { error: updateError } = await admin
    .from("bicycle_inspections")
    .update({ report_url: url, report_generated_at: new Date().toISOString() })
    .eq("id", inspectionId);
  if (updateError) throw updateError;

  return { url, orderId: order.id };
};
