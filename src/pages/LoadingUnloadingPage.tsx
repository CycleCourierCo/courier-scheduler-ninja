import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { StorageUnitLayout } from "@/components/loading/StorageUnitLayout";
import { PendingStorageAllocation } from "@/components/loading/PendingStorageAllocation";
import { BikesInStorage } from "@/components/loading/BikesInStorage";
import { RemoveBikesDialog } from "@/components/loading/RemoveBikesDialog";
import { getOrders } from "@/services/orderService";
import { Order } from "@/types/order";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck, Printer, CalendarIcon, Package } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';

// Storage allocation type
export type StorageAllocation = {
  id: string;
  orderId: string;
  bay: string; // A-D
  position: number; // 1-15
  bikeBrand?: string;
  bikeModel?: string;
  customerName: string;
  allocatedAt: Date;
  bikeIndex?: number; // Track which bike this is for multi-bike orders
};

const LoadingUnloadingPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [storageAllocations, setStorageAllocations] = useState<StorageAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Print labels state
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isLabelsDialogOpen, setIsLabelsDialogOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // Loading list state
  const [selectedLoadingDate, setSelectedLoadingDate] = useState<Date>();
  const [isLoadingDatePickerOpen, setIsLoadingDatePickerOpen] = useState(false);
  const [isLoadingListDialogOpen, setIsLoadingListDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ordersData = await getOrders();
        setOrders(ordersData);
        
        // Fetch storage allocations from localStorage for now
        // In a real app, this would be from a database
        const savedAllocations = localStorage.getItem('storageAllocations');
        if (savedAllocations) {
          const allocations = JSON.parse(savedAllocations);
          setStorageAllocations(allocations.map((a: any) => ({
            ...a,
            allocatedAt: new Date(a.allocatedAt)
          })));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper function to check if order has been collected based on tracking events
  const hasBeenCollected = (order: Order) => {
    // Check order status first
    if (order.status === 'collected' || order.status === 'driver_to_delivery') {
      return true;
    }
    
    // Check tracking events for collection indicators
    const trackingUpdates = order.trackingEvents?.shipday?.updates || [];
    return trackingUpdates.some(update => 
      update.description?.toLowerCase().includes('collected') || 
      update.description?.toLowerCase().includes('pickup') ||
      update.event === 'ORDER_POD_UPLOAD' ||
      update.status?.toLowerCase().includes('collected')
    );
  };

  // Helper function to check if order has been delivered
  const hasBeenDelivered = (order: Order) => {
    // Check order status first
    if (order.status === 'delivered') {
      return true;
    }
    
    // Check tracking events for delivery indicators
    const trackingUpdates = order.trackingEvents?.shipday?.updates || [];
    return trackingUpdates.some(update => 
      update.description?.toLowerCase().includes('delivered') || 
      update.event === 'DELIVERY_POD_UPLOAD' ||
      update.status?.toLowerCase().includes('delivered')
    );
  };

  // Get bikes that need storage allocation (collected but not delivered, not cancelled, and no storage allocation)
  const collectedBikes = orders.filter(order => 
    hasBeenCollected(order) && 
    !hasBeenDelivered(order) &&
    order.status !== 'cancelled' &&
    !storageAllocations.some(allocation => allocation.orderId === order.id)
  );

  // Get all bikes that have storage allocations (regardless of delivery status)
  const bikesInStorage = storageAllocations.map(allocation => {
    const order = orders.find(o => o.id === allocation.orderId);
    return { allocation, order };
  }).filter(item => item.order); // Only include if order still exists

  const handleAllocateStorage = (orderId: string, allocationsToMake: { bay: string; position: number; bikeIndex: number }[]) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Check if any bay/position is already occupied
    for (const allocation of allocationsToMake) {
      const isOccupied = storageAllocations.some(
        existing => existing.bay === allocation.bay && existing.position === allocation.position
      );

      if (isOccupied) {
        toast.error(`Bay ${allocation.bay}${allocation.position} is already occupied`);
        return;
      }
    }

    // Create all new allocations
    const newAllocations: StorageAllocation[] = allocationsToMake.map(allocation => ({
      id: crypto.randomUUID(),
      orderId,
      bay: allocation.bay,
      position: allocation.position,
      bikeBrand: order.bikeBrand,
      bikeModel: order.bikeModel,
      customerName: order.sender.name,
      allocatedAt: new Date(),
      bikeIndex: allocation.bikeIndex
    }));

    const updatedAllocations = [...storageAllocations, ...newAllocations];
    setStorageAllocations(updatedAllocations);
    
    // Save to localStorage
    localStorage.setItem('storageAllocations', JSON.stringify(updatedAllocations));
    
    const bikeQuantity = order.bikeQuantity || 1;
    const totalAllocatedCount = updatedAllocations.filter(a => a.orderId === orderId).length;
    
    toast.success(`Successfully allocated ${allocationsToMake.length} bike(s). Total: ${totalAllocatedCount}/${bikeQuantity} bikes allocated for this order.`);
  };

  const handleRemoveFromStorage = (allocationId: string) => {
    const updatedAllocations = storageAllocations.filter(
      allocation => allocation.id !== allocationId
    );
    setStorageAllocations(updatedAllocations);
    
    // Save to localStorage
    localStorage.setItem('storageAllocations', JSON.stringify(updatedAllocations));
    
    toast.success('Bike loaded onto van and removed from storage');
  };

  const handleChangeLocation = (allocationId: string, newBay: string, newPosition: number) => {
    // Check if the new bay/position is already occupied
    const isOccupied = storageAllocations.some(
      allocation => 
        allocation.bay === newBay && 
        allocation.position === newPosition &&
        allocation.id !== allocationId // Don't count the current allocation
    );

    if (isOccupied) {
      toast.error(`Bay ${newBay}${newPosition} is already occupied`);
      return;
    }

    const updatedAllocations = storageAllocations.map(allocation =>
      allocation.id === allocationId
        ? { ...allocation, bay: newBay, position: newPosition }
        : allocation
    );
    setStorageAllocations(updatedAllocations);
    
    // Save to localStorage
    localStorage.setItem('storageAllocations', JSON.stringify(updatedAllocations));
    
    toast.success(`Bike moved to bay ${newBay}${newPosition}`);
  };

  // Print labels functionality
  const handlePrintLabels = async () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    setIsGeneratingPDF(true);
    
    try {
      const orders = await getOrders();
      // Filter for collection/pickup dates for the labels
      const scheduledOrders = orders.filter(order => {
        const scheduledPickup = order.scheduledPickupDate;
        
        if (!scheduledPickup) return false;
        
        const targetDate = format(selectedDate, 'yyyy-MM-dd');
        const pickupDate = format(new Date(scheduledPickup), 'yyyy-MM-dd');
        
        return pickupDate === targetDate;
      });

      // Get delivery orders for the loading list
      const deliveryOrders = orders.filter(order => {
        const scheduledDelivery = order.scheduledDeliveryDate;
        
        if (!scheduledDelivery) return false;
        
        const targetDate = format(selectedDate, 'yyyy-MM-dd');
        const deliveryDate = format(new Date(scheduledDelivery), 'yyyy-MM-dd');
        
        return deliveryDate === targetDate;
      });

      if (scheduledOrders.length === 0) {
        toast.info("No collection orders scheduled for the selected date");
        return;
      }

      await generateLabels(scheduledOrders, deliveryOrders);
      toast.success(`Generated collection labels for ${scheduledOrders.length} orders`);
      setIsLabelsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to generate labels");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateLabels = async (orders: Order[], deliveryOrders: Order[]) => {
    try {
      // Create PDF with exact 4x6 inch page size for label printers
      const labelWidth = 288; // 4 inches in points
      const labelHeight = 432; // 6 inches in points
      
      const pdf = new jsPDF('portrait', 'pt', [labelWidth, labelHeight]);
      let isFirstLabel = true;
      
      // Generate loading list as first label
      const margin = 15;
      let currentY = margin + 20;
      
      // Title
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text('DELIVERY LOADING LIST', margin, currentY);
      currentY += 25;
      
      // Date
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Date: ${format(selectedDate!, 'dd/MM/yyyy')}`, margin, currentY);
      currentY += 25;
      
      // Simple bullet point list for delivery bikes
      pdf.setFontSize(10);
      deliveryOrders.forEach((order) => {
        const quantity = order.bikeQuantity || 1;
        
        for (let i = 0; i < quantity; i++) {
          const customerName = order.receiver?.name || 'Unknown Customer';
          const bikeBrand = order.bikeBrand || 'Unknown';
          const bikeModel = order.bikeModel || 'Bike';
          const bikeInfo = `${bikeBrand} ${bikeModel}`.trim();
          
          pdf.text(`• ${bikeInfo} - ${customerName}`, margin, currentY);
          currentY += 15;
        }
      });
      
      // Individual collection labels
      orders.forEach((order) => {
        const quantity = order.bikeQuantity || 1;
        
        for (let i = 0; i < quantity; i++) {
          pdf.addPage();

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
          
          // Logo
          try {
            const logoWidth = (labelWidth - (2 * margin)) * 0.51;
            const logoHeight = logoWidth;
            const logoX = (labelWidth - logoWidth) / 2;
            
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
            // Logo loading failed - continue without it
          }
        }
      });

      pdf.save(`collection-labels-${format(selectedDate!, 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
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

  // Get bikes needing loading for selected date
  const getBikesNeedingLoading = (date: Date) => {
    return orders.filter(order => {
      const scheduledDelivery = order.scheduledDeliveryDate;
      
      if (!scheduledDelivery) return false;
      
      const targetDate = format(date, 'yyyy-MM-dd');
      const deliveryDate = format(new Date(scheduledDelivery), 'yyyy-MM-dd');
      
      return deliveryDate === targetDate;
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Loading & Unloading</h1>
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-3">
              {/* Print Collection Labels */}
              <Dialog open={isLabelsDialogOpen} onOpenChange={setIsLabelsDialogOpen}>
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

              {/* Loading List for Date */}
              <Dialog open={isLoadingListDialogOpen} onOpenChange={setIsLoadingListDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Package className="mr-2 h-4 w-4" />
                    View Loading List
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Bikes Needing Loading</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Popover open={isLoadingDatePickerOpen} onOpenChange={setIsLoadingDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedLoadingDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedLoadingDate ? format(selectedLoadingDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={selectedLoadingDate}
                          onSelect={(date) => {
                            setSelectedLoadingDate(date);
                            setIsLoadingDatePickerOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    
                    {selectedLoadingDate && (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        <div className="text-sm text-muted-foreground">
                          Bikes scheduled for delivery on {format(selectedLoadingDate, "PPP")}:
                        </div>
                        
                        {getBikesNeedingLoading(selectedLoadingDate).map((order) => {
                          const quantity = order.bikeQuantity || 1;
                          return (
                            <Card key={order.id} className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium">
                                    {order.receiver?.name || 'Unknown Customer'}
                                  </div>
                                  {quantity > 1 && (
                                    <div className="text-xs bg-muted px-2 py-1 rounded">
                                      {quantity} bikes
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <div>{order.bikeBrand} {order.bikeModel}</div>
                                  <div>Tracking: {order.trackingNumber}</div>
                                  <div>To: {order.receiver?.address?.city}, {order.receiver?.address?.zipCode}</div>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                        
                        {getBikesNeedingLoading(selectedLoadingDate).length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No bikes scheduled for delivery on this date</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Storage Unit Layout */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Storage Unit Layout</CardTitle>
          </CardHeader>
          <CardContent>
            <StorageUnitLayout 
              storageAllocations={storageAllocations}
            />
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Bikes Pending Storage Allocation */}
          <Card>
            <CardHeader>
              <CardTitle>Bikes Pending Storage Allocation</CardTitle>
              <p className="text-sm text-muted-foreground">
                {collectedBikes.length} bike(s) collected and awaiting storage allocation
              </p>
            </CardHeader>
            <CardContent>
              <PendingStorageAllocation 
                collectedBikes={collectedBikes}
                storageAllocations={storageAllocations}
                onAllocateStorage={handleAllocateStorage}
              />
            </CardContent>
          </Card>

          {/* Bikes in Storage */}
          <Card>
            <CardHeader>
              <CardTitle>Bikes in Storage</CardTitle>
              <p className="text-sm text-muted-foreground">
                {bikesInStorage.length} bike(s) currently in storage
              </p>
            </CardHeader>
            <CardContent>
              <BikesInStorage 
                bikesInStorage={bikesInStorage}
                onRemoveFromStorage={handleRemoveFromStorage}
                onChangeLocation={handleChangeLocation}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default LoadingUnloadingPage;