import jsPDF from 'jspdf';
import { format } from "date-fns";
import type { Order } from "@/types/order";

const LABEL_WIDTH = 288; // 4 inches in points
const LABEL_HEIGHT = 432; // 6 inches in points
const MARGIN = 15;
const ICON_SIZE = 20;
const INDICATOR_GAP = 8;

export const generateSingleOrderLabel = async (order: Order) => {
  try {
    const pdf = new jsPDF('portrait', 'pt', [LABEL_WIDTH, LABEL_HEIGHT]);
    const quantity = order.bikeQuantity || 1;
    let isFirstLabel = true;

    for (let i = 0; i < quantity; i++) {
      if (!isFirstLabel) {
        pdf.addPage();
      }
      isFirstLabel = false;
      renderLabelPage(pdf, order, i, quantity, LABEL_WIDTH);
    }

    pdf.save(`collection-label-${order.trackingNumber || order.id}.pdf`);
  } catch (error) {
    console.error("PDF generation error:", error);
    throw new Error(`PDF generation failed: ${error.message || 'Unknown error'}`);
  }
};

export const generateBulkCollectionLabels = async (orders: Order[]) => {
  try {
    const pdf = new jsPDF('portrait', 'pt', [LABEL_WIDTH, LABEL_HEIGHT]);
    let isFirstPage = true;

    for (const order of orders) {
      const quantity = order.bikeQuantity || 1;
      for (let i = 0; i < quantity; i++) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;
        renderLabelPage(pdf, order, i, quantity, LABEL_WIDTH);
      }
    }

    pdf.save(`collection-labels-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } catch (error) {
    console.error("Bulk PDF generation error:", error);
    throw new Error(`Bulk PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const drawIcon = (pdf: jsPDF, path: string, x: number, y: number, size: number): boolean => {
  try {
    pdf.addImage(path, 'PNG', x, y, size, size);
    return true;
  } catch (error) {
    console.log(`Could not load icon ${path}:`, error);
    return false;
  }
};

const renderIndicatorRow = (
  pdf: jsPDF,
  order: Order,
  startY: number,
  margin: number
): number => {
  const hasIndicators = order.needsInspection || order.isBoxMyBike || order.isNorthernIreland;
  if (!hasIndicators) return startY;

  let currentX = margin;
  const centerY = startY + ICON_SIZE / 2 + 3;

  if (order.needsInspection) {
    if (drawIcon(pdf, '/label-icon-repair.png', currentX, startY, ICON_SIZE)) {
      currentX += ICON_SIZE + INDICATOR_GAP;
    }
  }

  if (order.isBoxMyBike) {
    if (drawIcon(pdf, '/label-icon-box.png', currentX, startY, ICON_SIZE)) {
      currentX += ICON_SIZE + INDICATOR_GAP;
    }
  }

  if (order.isNorthernIreland) {
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    const niText = 'NI';
    const niWidth = pdf.getTextWidth(niText) + 8;
    pdf.rect(currentX, startY, niWidth, ICON_SIZE);
    pdf.text(niText, currentX + 4, centerY);
    currentX += niWidth + INDICATOR_GAP;
  }

  return startY + ICON_SIZE + 24;
};

const renderLabelPage = (pdf: jsPDF, order: Order, bikeIndex: number, quantity: number, labelWidth: number) => {
  let currentY = MARGIN + 20;

  // Tracking number
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  const trackingText = `Tracking: ${order.trackingNumber || 'N/A'}${quantity > 1 ? ` (${bikeIndex + 1}/${quantity})` : ''}`;
  pdf.text(trackingText, MARGIN, currentY);
  currentY += 30;

  // Bike details
  if (order.bikeBrand || order.bikeModel || order.bikeQuantity) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text('ITEM:', MARGIN, currentY);
    currentY += 15;

    pdf.setFont("helvetica", "normal");
    const isMultipleBikes = quantity > 1;
    const itemName = isMultipleBikes
      ? `Bike ${bikeIndex + 1} of ${quantity}`
      : `${order.bikeBrand || ""} ${order.bikeModel || ""}`.trim() || "Bike";

    if (!isMultipleBikes && order.bikeBrand && order.bikeModel) {
      pdf.text(`${order.bikeBrand} ${order.bikeModel}`, MARGIN, currentY);
    } else {
      pdf.text(itemName, MARGIN, currentY);
    }
    currentY += 12;

    if (order.bikeType) {
      pdf.text(`Type: ${order.bikeType}`, MARGIN, currentY);
    }
    currentY += 15;
  }

  // Service / Box / NI indicators
  currentY = renderIndicatorRow(pdf, order, currentY, MARGIN);

  // Receiver info (TO)
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text('TO:', MARGIN, currentY);
  currentY += 15;

  pdf.setFont("helvetica", "normal");
  if (order.receiver?.name) {
    pdf.text(order.receiver.name, MARGIN, currentY);
    currentY += 12;
  }

  if (order.receiver?.address) {
    const address = order.receiver.address;
    if (address.street) {
      const streetText = splitText(pdf, address.street, labelWidth - 2 * MARGIN);
      streetText.forEach(line => {
        pdf.text(line, MARGIN, currentY);
        currentY += 12;
      });
    }
    const cityLine = `${address.city || ''}, ${address.state || ''} ${address.zipCode || ''}`.trim();
    if (cityLine.length > 2) {
      pdf.text(cityLine, MARGIN, currentY);
      currentY += 12;
    }
  }

  if (order.receiver?.phone) {
    pdf.text(order.receiver.phone, MARGIN, currentY);
    currentY += 25;
  }

  // Contact information and website
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  const contactText = 'cyclecourierco.com | info@cyclecourierco.com | +44 121 798 0767';
  const contactWidth = pdf.getTextWidth(contactText);
  const contactX = (labelWidth - contactWidth) / 2;
  pdf.text(contactText, contactX, currentY);
  currentY += 20;

  // Logo
  try {
    const logoWidth = (labelWidth - (2 * MARGIN)) * 0.51;
    const logoHeight = logoWidth;
    const logoX = (labelWidth - logoWidth) / 2;
    pdf.addImage('/cycle-courier-logo.png', 'PNG', logoX, currentY, logoWidth, logoHeight);
    currentY += logoHeight + 10;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const taglineText = 'Streamlining Bike Transport';
    const taglineWidth = pdf.getTextWidth(taglineText);
    const taglineX = (labelWidth - taglineWidth) / 2;
    pdf.text(taglineText, taglineX, currentY);
  } catch (error) {
    console.log('Could not load logo:', error);
  }
};

const splitText = (pdf: jsPDF, text: string, maxWidth: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const textWidth = pdf.getTextWidth(testLine);

    if (textWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};
