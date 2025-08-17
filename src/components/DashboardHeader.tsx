
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
      const scheduledOrders = orders.filter(order => {
        const scheduledPickup = order.scheduledPickupDate;
        const scheduledDelivery = order.scheduledDeliveryDate;
        
        if (!scheduledPickup && !scheduledDelivery) return false;
        
        const targetDate = format(selectedDate, 'yyyy-MM-dd');
        const pickupDate = scheduledPickup ? format(new Date(scheduledPickup), 'yyyy-MM-dd') : null;
        const deliveryDate = scheduledDelivery ? format(new Date(scheduledDelivery), 'yyyy-MM-dd') : null;
        
        return pickupDate === targetDate || deliveryDate === targetDate;
      });

      if (scheduledOrders.length === 0) {
        toast.info("No orders scheduled for the selected date");
        return;
      }

      await generateLabels(scheduledOrders);
      toast.success(`Generated labels for ${scheduledOrders.length} orders`);
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
      const pdf = new jsPDF('portrait', 'pt', 'letter');
      
      // 4x6 inch labels in points (72 points per inch)
      const labelWidth = 288; // 4 inches
      const labelHeight = 432; // 6 inches
      
      orders.forEach((order, index) => {
        if (index > 0) {
          pdf.addPage();
        }

        // Center the label on the page
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const x = (pageWidth - labelWidth) / 2;
        const y = (pageHeight - labelHeight) / 2;

        // Draw label border
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(1);
        pdf.rect(x, y, labelWidth, labelHeight);
        
        // Add content with proper error handling
        const margin = 15;
        let currentY = y + margin + 20;
        
        // Tracking number
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        const trackingText = `Tracking: ${order.trackingNumber || 'N/A'}`;
        pdf.text(trackingText, x + margin, currentY);
        currentY += 25;
        
        // Sender info
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text('FROM:', x + margin, currentY);
        currentY += 15;
        
        pdf.setFont("helvetica", "normal");
        if (order.sender?.name) {
          pdf.text(order.sender.name, x + margin, currentY);
          currentY += 12;
        }
        
        if (order.sender?.address) {
          const address = order.sender.address;
          if (address.street) {
            const streetText = splitText(pdf, address.street, labelWidth - 2 * margin);
            streetText.forEach(line => {
              pdf.text(line, x + margin, currentY);
              currentY += 12;
            });
          }
          
          const cityLine = `${address.city || ''}, ${address.state || ''} ${address.zipCode || ''}`.trim();
          if (cityLine.length > 2) {
            pdf.text(cityLine, x + margin, currentY);
            currentY += 12;
          }
        }
        
        if (order.sender?.phone) {
          pdf.text(order.sender.phone, x + margin, currentY);
          currentY += 25;
        }
        
        // Receiver info
        pdf.setFont("helvetica", "bold");
        pdf.text('TO:', x + margin, currentY);
        currentY += 15;
        
        pdf.setFont("helvetica", "normal");
        if (order.receiver?.name) {
          pdf.text(order.receiver.name, x + margin, currentY);
          currentY += 12;
        }
        
        if (order.receiver?.address) {
          const address = order.receiver.address;
          if (address.street) {
            const streetText = splitText(pdf, address.street, labelWidth - 2 * margin);
            streetText.forEach(line => {
              pdf.text(line, x + margin, currentY);
              currentY += 12;
            });
          }
          
          const cityLine = `${address.city || ''}, ${address.state || ''} ${address.zipCode || ''}`.trim();
          if (cityLine.length > 2) {
            pdf.text(cityLine, x + margin, currentY);
            currentY += 12;
          }
        }
        
        if (order.receiver?.phone) {
          pdf.text(order.receiver.phone, x + margin, currentY);
          currentY += 15;
        }
        
        // Add company logo and contact info at bottom
        const bottomY = y + labelHeight - 60; // Reserve space at bottom
        
        try {
          // Add logo (try to load it, if it fails, continue without it)
          const logoImg = new Image();
          logoImg.onload = () => {
            const logoWidth = 40;
            const logoHeight = 30;
            const logoX = x + margin;
            pdf.addImage(logoImg, 'PNG', logoX, bottomY - logoHeight, logoWidth, logoHeight);
          };
          logoImg.src = '/cycle-courier-logo.png';
        } catch (error) {
          console.log('Logo not found, continuing without it');
        }
        
        // Add contact information
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        const contactY = bottomY - 5;
        pdf.text('cyclecourierco.com | info@cyclecourierco.com | +44 121 798 0767', x + margin, contactY);
      });

      pdf.save(`shipping-labels-${format(selectedDate!, 'yyyy-MM-dd')}.pdf`);
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
                    Print Labels
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Date for Labels</DialogTitle>
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
                      {isGeneratingPDF ? "Generating..." : "Generate Labels"}
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
