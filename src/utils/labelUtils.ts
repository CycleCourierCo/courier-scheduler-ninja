import jsPDF from 'jspdf';
import { format } from "date-fns";
import type { Order } from "@/types/order";
import { supabase } from "@/integrations/supabase/client";
import thermalHeader from "@/assets/brand/mark-1bit-128.png.asset.json";
import thermalCompactHeader from "@/assets/brand/mark-1bit-64.png.asset.json";
import repairIcon from "@/assets/labels/label-icon-repair.png.asset.json";
import boxIcon from "@/assets/labels/label-icon-box.png.asset.json";
import { publicBrandAssetUrl } from "@/lib/brandAssets";
import { createLabelQr } from './labelQr';

export const LABEL_WIDTH = 288; // 4 inches in points
export const LABEL_HEIGHT = 432; // 6 inches in points
const MARGIN = 15;
const BODY_SIZE = 12;
const LINE_HEIGHT = 15;
const ICON_SIZE = 24;
const INDICATOR_GAP = 12;
// The 1-bit cloud mark is placed at 100% (one image pixel per printer dot at
// 203 dpi). Scaling would resample it and reintroduce greys.
const PRINTER_DPI = 203;
const MARK_FULL_PX = 128;
const MARK_COMPACT_PX = 64;
const MARK_FULL_PT = MARK_FULL_PX * 72 / PRINTER_DPI;
const MARK_COMPACT_PT = MARK_COMPACT_PX * 72 / PRINTER_DPI;
const MARK_TOP = 10;
const HEADER_HEIGHT = MARK_TOP + Math.max(MARK_FULL_PT, 34) + 60;
const COMPACT_HEADER_HEIGHT = MARK_TOP + Math.max(MARK_COMPACT_PT, 34) + 60;

type ThermalArtwork = {
  full: Uint8Array;
  compact: Uint8Array;
  repair?: Uint8Array;
  box?: Uint8Array;
};
let artwork: ThermalArtwork | undefined;
let artworkRequest: Promise<ThermalArtwork> | undefined;

/** Preload original one-bit bytes; never round-trip through a canvas. */
export const prepareThermalLabelArtwork = (): Promise<ThermalArtwork> => {
  if (artwork) return Promise.resolve(artwork);
  if (!artworkRequest) {
    const load = async (path: string) => {
      const response = await fetch(publicBrandAssetUrl(path));
      if (!response.ok) throw new Error("Could not load thermal label artwork. Please try again.");
      return new Uint8Array(await response.arrayBuffer());
    };
    const loadOptionalIcon = async (path: string) => {
      try {
        return await load(path);
      } catch (error) {
        console.warn(`Could not preload thermal label icon ${path}:`, error);
        return undefined;
      }
    };
    artworkRequest = Promise.all([
      load(thermalHeader.url),
      load(thermalCompactHeader.url),
      loadOptionalIcon(repairIcon.url),
      loadOptionalIcon(boxIcon.url),
    ])
      .then(([full, compact, repair, box]) => {
        artwork = { full, compact, repair, box };
        return artwork;
      }).catch((error) => {
        artworkRequest = undefined;
        throw error;
      });
  }
  return artworkRequest;
};

/**
 * Returns the set of account (user) ids that have opted in to showing the
 * sender's name on printed labels.
 */
export const resolveSenderLabelAccounts = async (orders: Order[]): Promise<Set<string>> => {
  const userIds = Array.from(
    new Set(orders.map((o) => (o as any)?.user_id).filter((id): id is string => typeof id === 'string' && id.length > 0))
  );
  if (userIds.length === 0) return new Set<string>();

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, show_sender_on_label')
      .in('id', userIds);
    if (error) throw error;
    return new Set((data || []).filter((p: any) => p.show_sender_on_label).map((p: any) => p.id as string));
  } catch (error) {
    console.error('Could not resolve sender-name label flags:', error);
    return new Set<string>();
  }
};

const shouldShowSender = (order: Order, allowedAccounts: Set<string>): boolean => {
  const userId = (order as any)?.user_id;
  return typeof userId === 'string' && allowedAccounts.has(userId);
};

export const generateSingleOrderLabel = async (order: Order) => {
  try {
    const [allowedAccounts] = await Promise.all([resolveSenderLabelAccounts([order]), prepareThermalLabelArtwork()]);
    const pdf = new jsPDF('portrait', 'pt', [LABEL_WIDTH, LABEL_HEIGHT]);
    const quantity = order.bikeQuantity || 1;
    let isFirstLabel = true;

    for (let i = 0; i < quantity; i++) {
      if (!isFirstLabel) {
        pdf.addPage();
      }
      isFirstLabel = false;
      renderLabelPage(pdf, order, i, quantity, LABEL_WIDTH, shouldShowSender(order, allowedAccounts));
    }

    pdf.save(`collection-label-${order.trackingNumber || order.id}.pdf`);
  } catch (error) {
    console.error("PDF generation error:", error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const generateBulkCollectionLabels = async (orders: Order[]) => {
  try {
    const [allowedAccounts] = await Promise.all([resolveSenderLabelAccounts(orders), prepareThermalLabelArtwork()]);
    const pdf = new jsPDF('portrait', 'pt', [LABEL_WIDTH, LABEL_HEIGHT]);
    let isFirstPage = true;

    // Yield to the browser every few labels so a large batch doesn't freeze the
    // tab (and trigger "page took too long to respond").
    let sinceYield = 0;
    for (const order of orders) {
      const quantity = order.bikeQuantity || 1;
      for (let i = 0; i < quantity; i++) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;
        renderLabelPage(pdf, order, i, quantity, LABEL_WIDTH, shouldShowSender(order, allowedAccounts));
        if (++sinceYield >= 10) {
          sinceYield = 0;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }

    pdf.save(`collection-labels-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } catch (error) {
    console.error("Bulk PDF generation error:", error);
    throw new Error(`Bulk PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};


/** Shared thermal renderer for single, bulk and driver-grouped labels. */
export const renderLabelPage = (
  pdf: jsPDF, order: Order, bikeIndex: number, quantity: number,
  labelWidth: number = LABEL_WIDTH, showSenderName: boolean = false
) => {
  if (!artwork) throw new Error("Thermal label artwork must be loaded before rendering.");
  if (labelWidth !== LABEL_WIDTH) throw new Error("Thermal labels must be printed at their native four-inch width.");
  const contentWidth = labelWidth - 2 * MARGIN;
  pdf.setTextColor(0);
  pdf.setDrawColor(0);
  pdf.setLineWidth(1.42); // 0.5 mm minimum for PDF rules and badge outlines
  pdf.setFont("helvetica", "bold");

  const wrap = (text: string, size: number) => {
    pdf.setFontSize(size);
    return pdf.splitTextToSize(text, contentWidth) as string[];
  };
  const reference = order.trackingNumber || order.id;
  const qr = createLabelQr(reference);
  const printerDot = 72 / PRINTER_DPI;
  // Four-module white quiet zone on every side of the code.
  const qrModules = qr.getModuleCount() + 8;
  const qrSizeAt = (dots: number) => qrModules * dots * printerDot;
  const QR_GAP = 12;
  pdf.setFontSize(16);
  const trackingLines = pdf.splitTextToSize(order.trackingNumber || 'N/A', contentWidth) as string[];
  const trackingBlock = 20 + trackingLines.length * 20 + 20;
  const senderLines = showSenderName && order.sender?.name ? wrap(order.sender.name, BODY_SIZE) : [];
  const address = order.receiver?.address;
  const receiverLines = [
    order.receiver?.name,
    address?.street,
    [address?.city, address?.state, address?.zipCode].filter(Boolean).join(' '),
    order.receiver?.phone,
  ].filter((value): value is string => Boolean(value)).flatMap(value => wrap(value, BODY_SIZE));

  const bike = order.bikes?.[bikeIndex];
  const itemName = bike
    ? [bike.brand, bike.model].filter(Boolean).join(' ') || 'Bike'
    : quantity > 1 ? `Bike ${bikeIndex + 1} of ${quantity}`
    : [order.bikeBrand, order.bikeModel].filter(Boolean).join(' ') || 'Bike';
  const itemLines = wrap(itemName, BODY_SIZE);
  const bikeType = bike?.type || order.bikeType;
  const typeLines = bikeType ? wrap(`Type: ${bikeType}`, BODY_SIZE) : [];
  const codeLines = order.collectionCode ? wrap(`eBay Code: ${order.collectionCode}`, BODY_SIZE) : [];
  const hasIndicators = order.needsInspection || order.isBoxMyBike || order.isNorthernIreland;

  // Measure the entire body before choosing artwork; never shrink text to fit.
  const textBlock = trackingBlock
    + (senderLines.length ? LINE_HEIGHT + senderLines.length * LINE_HEIGHT + 30 : 0)
    + LINE_HEIGHT + receiverLines.length * LINE_HEIGHT + 30
    + LINE_HEIGHT + (itemLines.length + typeLines.length + codeLines.length) * LINE_HEIGHT
    + (hasIndicators ? ICON_SIZE + 10 : 0);
  // The QR code sits at the bottom: use the largest whole-dot size that fits.
  const fitFor = (header: number) => {
    const available = LABEL_HEIGHT - MARGIN - (header + 8 + textBlock);
    for (const dots of [5, 4, 3]) {
      if (qrSizeAt(dots) + QR_GAP * 2 <= available) return { header, dots };
    }
    return null;
  };
  const fit = fitFor(HEADER_HEIGHT) ?? fitFor(COMPACT_HEADER_HEIGHT);
  if (!fit) {
    throw new Error(`Label details for ${order.trackingNumber || order.id} are too long to fit safely on a 4 × 6 label.`);
  }
  const useCompact = fit.header === COMPACT_HEADER_HEIGHT;
  const headerHeight = fit.header;
  const qrSize = qrSizeAt(fit.dots);
  const qrModule = fit.dots * printerDot;
  const markSize = useCompact ? MARK_COMPACT_PT : MARK_FULL_PT;
  pdf.addImage(useCompact ? artwork.compact : artwork.full, 'PNG', MARGIN, MARK_TOP,
    markSize, markSize, useCompact ? 'thermal-mark-64' : 'thermal-mark-128', 'NONE');
  // Draw wording as crisp PDF text, keeping the original mark at printer-dot size.
  const brandX = MARGIN + markSize + 10;
  pdf.setFontSize(14);
  pdf.text('CYCLE COURIER CO.', brandX, MARK_TOP + 22);
  let brandY = MARK_TOP + Math.max(markSize, 34) + 12;
  pdf.setFontSize(10);
  for (const line of [
    'BOXED & UNBOXED BIKE DELIVERY',
    'ENGLAND · WALES · NORTHERN IRELAND',
    'INSPECTION & REPAIRS',
  ]) {
    pdf.text(line, MARGIN, brandY);
    brandY += 12;
  }
  pdf.text('Cyclecourierco.com · +44 121 798 0767', MARGIN, brandY + 2);
  const divider = (position: number) => pdf.line(MARGIN, position, labelWidth - MARGIN, position);
  divider(headerHeight + 6);
  let y = headerHeight + 20;
  const textLines = (lines: string[], size = BODY_SIZE, height = LINE_HEIGHT) => {
    pdf.setFontSize(size);
    lines.forEach(line => { pdf.text(line, MARGIN, y); y += height; });
  };
  pdf.setFontSize(BODY_SIZE);
  pdf.text(`TRACKING${quantity > 1 ? ` (${bikeIndex + 1}/${quantity})` : ''}`, MARGIN, y);
  y += 20;
  textLines(trackingLines, 16, 20);
  y += 4;
  divider(y);
  y += 16;
  if (senderLines.length) {
    pdf.setFontSize(BODY_SIZE);
    pdf.text('FROM:', MARGIN, y); y += LINE_HEIGHT;
    textLines(senderLines); y += 14;
    divider(y); y += 16;
  }
  pdf.setFontSize(BODY_SIZE);
  pdf.text('TO:', MARGIN, y); y += LINE_HEIGHT;
  textLines(receiverLines); y += 14;
  divider(y); y += 16;
  pdf.text('ITEM:', MARGIN, y); y += LINE_HEIGHT;
  textLines(itemLines);
  textLines(typeLines);
  textLines(codeLines);
  if (hasIndicators) {
    y += 10;
    let x = MARGIN;
    const drawFallback = (label: string) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      const width = Math.max(ICON_SIZE, pdf.getTextWidth(label) + 8);
      pdf.rect(x, y, width, ICON_SIZE, 'S');
      pdf.text(label, x + width / 2, y + 16, { align: 'center' });
      x += width + INDICATOR_GAP;
    };
    const drawIcon = (image: Uint8Array | undefined, alias: string, fallback: string) => {
      if (!image) {
        drawFallback(fallback);
        return;
      }
      try {
        pdf.addImage(image, 'PNG', x, y, ICON_SIZE, ICON_SIZE, alias, 'NONE');
        x += ICON_SIZE + INDICATOR_GAP;
      } catch (error) {
        console.warn(`Could not render thermal label icon ${alias}:`, error);
        drawFallback(fallback);
      }
    };

    if (order.needsInspection) drawIcon(artwork.repair, 'thermal-repair-icon', 'SERVICE');
    if (order.isBoxMyBike) drawIcon(artwork.box, 'thermal-box-icon', 'BOX');
    if (order.isNorthernIreland) drawFallback('NI');
  }

  // Tracking QR at the bottom of the label, right-aligned on whole printer dots.
  const qrX = Math.round((labelWidth - MARGIN - qrSize) / printerDot) * printerDot;
  const qrY = Math.round((LABEL_HEIGHT - MARGIN - qrSize) / printerDot) * printerDot;
  divider(qrY - QR_GAP);
  pdf.setFillColor('0');
  for (let row = 0; row < qr.getModuleCount(); row++) {
    for (let col = 0; col < qr.getModuleCount(); col++) {
      if (qr.isDark(row, col)) {
        pdf.rect(qrX + (col + 4) * qrModule, qrY + (row + 4) * qrModule,
          qrModule, qrModule, 'F');
      }
    }
  }
  pdf.setFontSize(12);
  pdf.text('SCAN TO TRACK', MARGIN, qrY + qrSize);
};
