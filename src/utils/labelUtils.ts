import jsPDF from 'jspdf';
import { format } from "date-fns";
import type { Order } from "@/types/order";

export const generateSingleOrderLabel = async (order: Order) => {
  try {
    // Create PDF with exact 4x6 inch page size for label printers
    const labelWidth = 288; // 4 inches in points
    const labelHeight = 432; // 6 inches in points
    
    const pdf = new jsPDF('portrait', 'pt', [labelWidth, labelHeight]);
    const quantity = order.bikeQuantity || 1;
    let isFirstLabel = true;
    
    // Generate labels based on bike quantity
    for (let i = 0; i < quantity; i++) {
      if (!isFirstLabel) {
        pdf.addPage();
      }
      isFirstLabel = false;

      const margin = 15;
      let currentY = margin + 20;
      
      // Tracking number
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      const trackingText = `Tracking: ${order.trackingNumber || 'N/A'}${quantity > 1 ? ` (${i + 1}/${quantity})` : ''}`;
      pdf.text(trackingText, margin, currentY);
      currentY += 30;
      
      // Bike details
      if (order.bikeBrand || order.bikeModel || order.bikeQuantity) {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text('ITEM:', margin, currentY);
        currentY += 15;
        
        pdf.setFont("helvetica", "normal");
        const isMultipleBikes = quantity > 1;
        const itemName = isMultipleBikes 
          ? `Bike ${i + 1} of ${quantity}` 
          : `${order.bikeBrand || ""} ${order.bikeModel || ""}`.trim() || "Bike";
        
        if (!isMultipleBikes && order.bikeBrand && order.bikeModel) {
          pdf.text(`${order.bikeBrand} ${order.bikeModel}`, margin, currentY);
        } else {
          pdf.text(itemName, margin, currentY);
        }
        currentY += 20;
      }
      
      // Sender info (FROM)
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text('FROM:', margin, currentY);
      currentY += 15;
      
      pdf.setFont("helvetica", "normal");
      if (order.sender?.name) {
        pdf.text(order.sender.name, margin, currentY);
        currentY += 12;
      }
      
      if (order.sender?.address) {
        const address = order.sender.address;
        if (address.street) {
          const streetText = splitText(pdf, address.street, labelWidth - 2 * margin);
          streetText.forEach(line => {
            pdf.text(line, margin, currentY);
            currentY += 12;
          });
        }
        
        const cityLine = `${address.city || ''}, ${address.state || ''} ${address.zipCode || ''}`.trim();
        if (cityLine.length > 2) {
          pdf.text(cityLine, margin, currentY);
          currentY += 12;
        }
      }
      
      if (order.sender?.phone) {
        pdf.text(order.sender.phone, margin, currentY);
        currentY += 25;
      }
      
      // Receiver info (TO)
      pdf.setFont("helvetica", "bold");
      pdf.text('TO:', margin, currentY);
      currentY += 15;
      
      pdf.setFont("helvetica", "normal");
      if (order.receiver?.name) {
        pdf.text(order.receiver.name, margin, currentY);
        currentY += 12;
      }
      
      if (order.receiver?.address) {
        const address = order.receiver.address;
        if (address.street) {
          const streetText = splitText(pdf, address.street, labelWidth - 2 * margin);
          streetText.forEach(line => {
            pdf.text(line, margin, currentY);
            currentY += 12;
          });
        }
        
        const cityLine = `${address.city || ''}, ${address.state || ''} ${address.zipCode || ''}`.trim();
        if (cityLine.length > 2) {
          pdf.text(cityLine, margin, currentY);
          currentY += 12;
        }
      }
      
      if (order.receiver?.phone) {
        pdf.text(order.receiver.phone, margin, currentY);
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
      
      // Logo - square ratio and reduced size
      try {
        const logoWidth = (labelWidth - (2 * margin)) * 0.51; // 51% of available width (reduced by another 15%)
        const logoHeight = logoWidth; // 1:1 ratio (square)
        const logoX = (labelWidth - logoWidth) / 2; // Center the logo
        
        pdf.addImage('/cycle-courier-logo.png', 'PNG', logoX, currentY, logoWidth, logoHeight);
        currentY += logoHeight + 10;
        
        // Tagline below logo
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const taglineText = 'Streamlining Bike Transport';
        const taglineWidth = pdf.getTextWidth(taglineText);
        const taglineX = (labelWidth - taglineWidth) / 2;
        pdf.text(taglineText, taglineX, currentY);
      } catch (error) {
        console.log('Could not load logo:', error);
      }
    }

    pdf.save(`collection-label-${order.trackingNumber || order.id}.pdf`);
  } catch (error) {
    console.error("PDF generation error:", error);
    throw new Error(`PDF generation failed: ${error.message || 'Unknown error'}`);
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