
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Calendar, Printer } from "lucide-react";
import { getOrders } from "@/services/orderService";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';
import type { Order } from "@/types/order";

interface DashboardHeaderProps {
  children?: React.ReactNode;
  showActionButtons?: boolean;
  userRole?: string | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  children, 
  showActionButtons = false,
  userRole = null
}) => {
  const isAdmin = userRole === 'admin';
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handlePrintLabels = async () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    setIsGeneratingPDF(true);
    
    try {
      const orders = await getOrders();
      // Only filter for collection/pickup dates
      const scheduledOrders = orders.filter(order => {
        const scheduledPickup = order.scheduledPickupDate;
        
        if (!scheduledPickup) return false;
        
        const targetDate = format(selectedDate, 'yyyy-MM-dd');
        const pickupDate = format(new Date(scheduledPickup), 'yyyy-MM-dd');
        
        return pickupDate === targetDate;
      });

      if (scheduledOrders.length === 0) {
        toast.info("No collection orders scheduled for the selected date");
        return;
      }

      await generateLabels(scheduledOrders);
      toast.success(`Generated collection labels for ${scheduledOrders.length} orders`);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error generating labels:", error);
      toast.error("Failed to generate labels");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateLabels = async (orders: Order[]) => {
    try {
      // Create PDF with exact 4x6 inch page size for label printers
      const labelWidth = 288; // 4 inches in points
      const labelHeight = 432; // 6 inches in points
      
      const pdf = new jsPDF('portrait', 'pt', [labelWidth, labelHeight]);
      let isFirstLabel = true;
      
      orders.forEach((order) => {
        const quantity = order.bikeQuantity || 1;
        
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
            
            pdf.addImage('/lovable-uploads/5014f666-d8af-4495-bf27-b2cbabee592f.png', 'PNG', logoX, currentY, logoWidth, logoHeight);
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
      });

      pdf.save(`collection-labels-${format(selectedDate!, 'yyyy-MM-dd')}.pdf`);
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

  return (
    <div className="flex flex-col space-y-4 pb-4">
      {children || (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage your delivery orders
          </p>
        </div>
      )}
      {showActionButtons && (
        <div className="flex justify-end space-x-2">
          {isAdmin && (
            <>
              <Button asChild variant="outline">
                <Link to="/scheduling">
                  <Calendar className="mr-2 h-4 w-4" />
                  Job Scheduling
                </Link>
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Collection Labels
                  </Button>
                </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Select Date for Collection Labels</DialogTitle>
                    </DialogHeader>
                  <div className="space-y-4">
                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            setSelectedDate(date);
                            setIsDatePickerOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      onClick={handlePrintLabels}
                      disabled={!selectedDate || isGeneratingPDF}
                      className="w-full"
                    >
                      {isGeneratingPDF ? "Generating..." : "Generate Collection Labels"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button asChild>
            <Link to="/create-order">
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
