
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
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // 4x6 inches = 288x432 points (72 points per inch)
    const labelWidth = 288;
    const labelHeight = 432;
    
    // Calculate how many labels fit per page
    const labelsPerRow = Math.floor(pageWidth / labelWidth);
    const labelsPerColumn = Math.floor(pageHeight / labelHeight);
    const labelsPerPage = labelsPerRow * labelsPerColumn;

    orders.forEach((order, index) => {
      if (index > 0 && index % labelsPerPage === 0) {
        pdf.addPage();
      }

      const labelIndex = index % labelsPerPage;
      const row = Math.floor(labelIndex / labelsPerRow);
      const col = labelIndex % labelsPerRow;
      
      const x = col * labelWidth;
      const y = row * labelHeight;

      // Draw label border
      pdf.rect(x, y, labelWidth, labelHeight);
      
      // Add content
      const margin = 10;
      let currentY = y + margin + 15;
      
      // Tracking number
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text(`Tracking: ${order.trackingNumber || 'N/A'}`, x + margin, currentY);
      currentY += 25;
      
      // Sender info
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('FROM:', x + margin, currentY);
      currentY += 15;
      
      pdf.setFont(undefined, 'normal');
      pdf.text(order.sender.name, x + margin, currentY);
      currentY += 12;
      pdf.text(order.sender.address.street, x + margin, currentY);
      currentY += 12;
      pdf.text(`${order.sender.address.city}, ${order.sender.address.state} ${order.sender.address.zipCode}`, x + margin, currentY);
      currentY += 12;
      pdf.text(order.sender.phone, x + margin, currentY);
      currentY += 25;
      
      // Receiver info
      pdf.setFont(undefined, 'bold');
      pdf.text('TO:', x + margin, currentY);
      currentY += 15;
      
      pdf.setFont(undefined, 'normal');
      pdf.text(order.receiver.name, x + margin, currentY);
      currentY += 12;
      pdf.text(order.receiver.address.street, x + margin, currentY);
      currentY += 12;
      pdf.text(`${order.receiver.address.city}, ${order.receiver.address.state} ${order.receiver.address.zipCode}`, x + margin, currentY);
      currentY += 12;
      pdf.text(order.receiver.phone, x + margin, currentY);
    });

    pdf.save(`shipping-labels-${format(selectedDate!, 'yyyy-MM-dd')}.pdf`);
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
