import jsPDF from 'jspdf';
import { format } from "date-fns";
import type { Order } from "@/types/order";
import { supabase } from "@/integrations/supabase/client";
import thermalHeader from "@/assets/brand/thermal-header-203dpi.png.asset.json";
import thermalCompactHeader from "@/assets/brand/thermal-header-compact-203dpi.png.asset.json";
import { publicBrandAssetUrl } from "@/lib/brandAssets";

export const LABEL_WIDTH = 288; // 4 inches in points
export const LABEL_HEIGHT = 432; // 6 inches in points
const MARGIN = 15;
const BODY_SIZE = 12;
const LINE_HEIGHT = 15;
const HEADER_HEIGHT = LABEL_WIDTH * 252 / 812;
const COMPACT_HEADER_HEIGHT = LABEL_WIDTH * 144 / 812;

type ThermalArtwork = { full: Uint8Array; compact: Uint8Array };
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
    artworkRequest = Promise.all([load(thermalHeader.url), load(thermalCompactHeader.url)])
      .then(([full, compact]) => {
        artwork = { full, compact };
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
  const trackingLines = wrap(order.trackingNumber || 'N/A', 16);
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
  const flags = [
    order.needsInspection ? 'INSPECTION' : '',
    order.isBoxMyBike ? 'BOX MY BIKE' : '',
    order.isNorthernIreland ? 'NI' : '',
  ].filter(Boolean);
  pdf.setFontSize(BODY_SIZE);
  const flagWidths = flags.map(flag => pdf.getTextWidth(flag) + 16);
  let flagRows = flags.length ? 1 : 0;
  let rowWidth = 0;
  flagWidths.forEach(width => {
    if (rowWidth && rowWidth + width > contentWidth) { flagRows++; rowWidth = 0; }
    rowWidth += width + 8;
  });

  // Measure the entire body before choosing artwork; never shrink text to fit.
  const bodyHeight = 12 + trackingLines.length * 20 + 10
    + (senderLines.length ? 15 + senderLines.length * LINE_HEIGHT + 10 : 0)
    + 15 + receiverLines.length * LINE_HEIGHT + 12
    + 15 + (itemLines.length + typeLines.length + codeLines.length) * LINE_HEIGHT
    + (flags.length ? 14 + flagRows * 30 : 0);
  const useCompact = HEADER_HEIGHT + 8 + bodyHeight > LABEL_HEIGHT - MARGIN;
  const headerHeight = useCompact ? COMPACT_HEADER_HEIGHT : HEADER_HEIGHT;
  if (headerHeight + 8 + bodyHeight > LABEL_HEIGHT - MARGIN) {
    throw new Error(`Label details for ${order.trackingNumber || order.id} are too long to fit safely on a 4 × 6 label.`);
  }
  pdf.addImage(useCompact ? artwork.compact : artwork.full, 'PNG', 0, 0,
    LABEL_WIDTH, headerHeight, useCompact ? 'thermal-compact-203' : 'thermal-full-203', 'NONE');
  let y = headerHeight + 20;
  const textLines = (lines: string[], size = BODY_SIZE, height = LINE_HEIGHT) => {
    pdf.setFontSize(size);
    lines.forEach(line => { pdf.text(line, MARGIN, y); y += height; });
  };
  pdf.setFontSize(BODY_SIZE);
  pdf.text(`TRACKING${quantity > 1 ? ` (${bikeIndex + 1}/${quantity})` : ''}`, MARGIN, y);
  y += 20;
  textLines(trackingLines, 16, 20);
  y += 5;
  if (senderLines.length) {
    pdf.setFontSize(BODY_SIZE);
    pdf.text('FROM:', MARGIN, y); y += LINE_HEIGHT;
    textLines(senderLines); y += 10;
  }
  pdf.setFontSize(BODY_SIZE);
  pdf.text('TO:', MARGIN, y); y += LINE_HEIGHT;
  textLines(receiverLines); y += 12;
  pdf.text('ITEM:', MARGIN, y); y += LINE_HEIGHT;
  textLines(itemLines);
  textLines(typeLines);
  textLines(codeLines);
  if (flags.length) {
    y += 8;
    let x = MARGIN;
    flags.forEach((flag, index) => {
      const width = flagWidths[index];
      if (x > MARGIN && x + width > labelWidth - MARGIN) { x = MARGIN; y += 30; }
      pdf.rect(x, y - 12, width, 24, 'S');
      pdf.text(flag, x + 8, y + 4);
      x += width + 8;
    });
  }
};
