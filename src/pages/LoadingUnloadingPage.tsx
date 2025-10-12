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
import { getOrders, getOrdersForLoading } from "@/services/orderService";
import { Order } from "@/types/order";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck, Printer, CalendarIcon, Package, Send } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { getDriverAssignment } from "@/utils/driverAssignmentUtils";
import { DEPOT_LOCATION, DEPOT_PROXIMITY_THRESHOLD_METERS } from "@/constants/depot";
import { calculateDistanceInMeters } from "@/utils/locationUtils";

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
  const [showDriverPhoneDialog, setShowDriverPhoneDialog] = useState(false);
  const [driversForLoading, setDriversForLoading] = useState<string[]>([]);
  const [driverPhoneNumbers, setDriverPhoneNumbers] = useState<Record<string, string>>({});
  const [showRemoveBikesDialog, setShowRemoveBikesDialog] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';

  // Helper to get bikes for delivery on a given date
  const getBikesForDelivery = (date: Date) => {
    return orders.filter(order => {
      if (!order.scheduledDeliveryDate) return false;
      const deliveryDate = format(new Date(order.scheduledDeliveryDate), 'yyyy-MM-dd');
      const targetDate = format(date, 'yyyy-MM-dd');
      return deliveryDate === targetDate && !order.loaded_onto_van;
    });
  };

  // Helper to get bikes loaded on a given date
  const getBikesLoadedOnDate = (date: Date) => {
    return orders.filter(order => {
      if (!order.scheduledDeliveryDate || !order.loaded_onto_van) return false;
      const deliveryDate = format(new Date(order.scheduledDeliveryDate), 'yyyy-MM-dd');
      const targetDate = format(date, 'yyyy-MM-dd');
      return deliveryDate === targetDate;
    });
  };

  const bikesForDelivery = selectedLoadingDate ? getBikesForDelivery(selectedLoadingDate) : [];
  const bikesLoadedOnDate = selectedLoadingDate ? getBikesLoadedOnDate(selectedLoadingDate) : [];

  const fetchData = async () => {
    try {
      setLoading(true);
      const ordersData = await getOrdersForLoading();
      setOrders(ordersData);
      
      // Fetch storage allocations from orders' storage_locations field
      const allAllocations: StorageAllocation[] = [];
      console.log('Processing orders for storage allocations:', ordersData.length);
      
      ordersData.forEach(order => {
        console.log(`Order ${order.id} storage_locations:`, order.storage_locations);
        
        if (order.storage_locations) {
          const orderAllocations = Array.isArray(order.storage_locations) 
            ? order.storage_locations 
            : [order.storage_locations];
          
          console.log(`Order ${order.id} parsed allocations:`, orderAllocations);
          
          orderAllocations.forEach((allocation: any) => {
            const parsedAllocation = {
              ...allocation,
              allocatedAt: new Date(allocation.allocatedAt)
            };
            console.log('Adding allocation:', parsedAllocation);
            allAllocations.push(parsedAllocation);
          });
        }
      });
      
      console.log('Storage allocations loaded:', allAllocations);
      setStorageAllocations(allAllocations);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
  const collectedBikes = orders.filter(order => {
    const hasCollection = hasBeenCollected(order);
    const hasDelivery = hasBeenDelivered(order);
    const isCancelled = order.status === 'cancelled';
    const hasStorage = storageAllocations.some(allocation => allocation.orderId === order.id);
    const isLoadedOntoVan = order.loaded_onto_van;
    
    console.log(`Order ${order.id}: collected=${hasCollection}, delivered=${hasDelivery}, cancelled=${isCancelled}, hasStorage=${hasStorage}, loadedOntoVan=${isLoadedOntoVan}`);
    
    return hasCollection && !hasDelivery && !isCancelled && !hasStorage && !isLoadedOntoVan;
  });

  // Get all bikes that have storage allocations (excluding loaded bikes)
  const bikesInStorage = storageAllocations.map(allocation => {
    const order = orders.find(o => o.id === allocation.orderId);
    console.log('Mapping allocation:', allocation, 'Found order:', order);
    return { allocation, order };
  }).filter(item => {
    const hasOrder = !!item.order;
    const isLoaded = item.order?.loaded_onto_van === true;
    console.log('Filtering item:', item, 'Has order:', hasOrder, 'Is loaded:', isLoaded);
    return hasOrder && !isLoaded;
  });

  console.log('Final bikesInStorage:', bikesInStorage);

  const handleAllocateStorage = async (orderId: string, allocationsToMake: { bay: string; position: number; bikeIndex: number }[]) => {
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

    try {
      // Get existing allocations for this order from the database
      const existingAllocations = order.storage_locations || [];
      const allOrderAllocations = [...existingAllocations, ...newAllocations];

      // Convert Date objects to ISO strings for JSON storage
      const allocationsForDb = allOrderAllocations.map(allocation => ({
        ...allocation,
        allocatedAt: allocation.allocatedAt instanceof Date ? allocation.allocatedAt.toISOString() : allocation.allocatedAt
      }));

      const { error } = await supabase
        .from('orders')
        .update({ storage_locations: allocationsForDb })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating storage locations:', error);
        toast.error('Failed to save storage allocation');
        return;
      }

      // Refresh data from database to ensure UI reflects the saved state
      await fetchData();
      
      const bikeQuantity = order.bikeQuantity || 1;
      const updatedCount = newAllocations.length;
      
      toast.success(`Successfully allocated ${updatedCount} bike(s) to storage.`);
    } catch (error) {
      console.error('Error updating storage locations:', error);
      toast.error('Failed to save storage allocation');
    }
  };

  const handleRemoveFromStorage = async (allocationId: string) => {
    // Find the allocation to remove
    const allocationToRemove = storageAllocations.find(a => a.id === allocationId);
    if (!allocationToRemove) return;

    const order = orders.find(o => o.id === allocationToRemove.orderId);
    if (!order) return;

    try {
      // Remove the allocation from the order's storage_locations
      const existingAllocations = order.storage_locations || [];
      const updatedAllocations = existingAllocations.filter((a: any) => a.id !== allocationId);

      const { error } = await supabase
        .from('orders')
        .update({ storage_locations: updatedAllocations.length > 0 ? updatedAllocations : null })
        .eq('id', allocationToRemove.orderId);

      if (error) {
        console.error('Error removing storage location:', error);
        toast.error('Failed to remove storage allocation');
        return;
      }

      // Refresh data from database to ensure UI reflects the saved state
      await fetchData();
      
      toast.success('Bike loaded onto van and removed from storage');
    } catch (error) {
      console.error('Error removing storage location:', error);
      toast.error('Failed to remove storage allocation');
    }
  };

  const handleRemoveAllBikesFromOrder = async (orderId: string) => {
    // Find all allocations for this order
    const orderAllocations = storageAllocations.filter(a => a.orderId === orderId);
    
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      // Always mark as loaded onto van, regardless of storage allocation status
      const updateData = {
        loaded_onto_van: true,
        loaded_onto_van_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Only clear storage locations if there are any
        ...(orderAllocations.length > 0 && { storage_locations: null })
      };

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order for van loading:', error);
        toast.error('Failed to load bikes onto van');
        return;
      }

      // Refresh data from database to ensure UI reflects the saved state
      await fetchData();
      
      if (orderAllocations.length > 0) {
        toast.success(`${orderAllocations.length} bike(s) loaded onto van and removed from storage`);
      } else {
        toast.success(`Bike(s) loaded onto van`);
      }
    } catch (error) {
      console.error('Error loading bikes onto van:', error);
      toast.error('Failed to load bikes onto van');
    }
  };

  const handleChangeLocation = async (allocationId: string, newBay: string, newPosition: number) => {
    // Find the allocation to update
    const allocationToUpdate = storageAllocations.find(a => a.id === allocationId);
    if (!allocationToUpdate) return;

    const order = orders.find(o => o.id === allocationToUpdate.orderId);
    if (!order) return;

    // Check if the new bay/position is already occupied by another bike
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

    try {
      // Update the allocation in the order's storage_locations
      const existingAllocations = order.storage_locations || [];
      const updatedAllocations = existingAllocations.map((a: any) => 
        a.id === allocationId 
          ? { ...a, bay: newBay, position: newPosition }
          : a
      );

      const { error } = await supabase
        .from('orders')
        .update({ storage_locations: updatedAllocations })
        .eq('id', allocationToUpdate.orderId);

      if (error) {
        console.error('Error updating storage location:', error);
        toast.error('Failed to update storage location');
        return;
      }

      // Refresh data from database to ensure UI reflects the saved state
      await fetchData();
      
      toast.success(`Bike moved to bay ${newBay}${newPosition}`);
    } catch (error) {
      console.error('Error updating storage location:', error);
      toast.error('Failed to update storage location');
    }
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
      
      // Individual collection labels
      orders.forEach((order) => {
        const quantity = order.bikeQuantity || 1;
        
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
      const scheduledPickup = order.scheduledPickupDate;
      
      if (!scheduledDelivery) return false;
      
      const targetDate = format(date, 'yyyy-MM-dd');
      const deliveryDate = format(new Date(scheduledDelivery), 'yyyy-MM-dd');
      
      // Exclude if already loaded onto van
      if (order.loaded_onto_van) return false;
      
      // Handle same-day collection and delivery
      if (scheduledPickup) {
        const pickupDate = format(new Date(scheduledPickup), 'yyyy-MM-dd');
        if (pickupDate === deliveryDate) {
          // Same-day collection and delivery detected
          // Check if COLLECTION is within 500m of depot
          const collectionLat = order.sender?.address?.lat;
          const collectionLon = order.sender?.address?.lon;
          
          if (collectionLat && collectionLon) {
            const distanceToDepot = calculateDistanceInMeters(
              DEPOT_LOCATION.lat,
              DEPOT_LOCATION.lon,
              collectionLat,
              collectionLon
            );
            
            // If collection is within 500m of depot, INCLUDE in loading list (driver won't have the bike yet)
            if (distanceToDepot <= DEPOT_PROXIMITY_THRESHOLD_METERS) {
              console.log(`Order ${order.trackingNumber}: Same-day but collection within ${Math.round(distanceToDepot)}m of depot - INCLUDING in loading list`);
              return deliveryDate === targetDate;
            } else {
              console.log(`Order ${order.trackingNumber}: Same-day and collection ${Math.round(distanceToDepot)}m from depot - EXCLUDING from loading list`);
              return false;
            }
          } else {
            // No coordinates available, default to original behavior (exclude same-day)
            console.log(`Order ${order.trackingNumber}: Same-day but no collection coordinates - EXCLUDING from loading list`);
            return false;
          }
        }
      }
      
      return deliveryDate === targetDate;
    });
  };

  const handleLoadOntoVan = (orderId: string) => {
    // Use the existing database-updating function for consistency
    handleRemoveAllBikesFromOrder(orderId);
  };

  const handleSendLoadingList = async () => {
    if (!selectedLoadingDate) {
      toast.error("Please select a date");
      return;
    }

    const bikesForDate = getBikesNeedingLoading(selectedLoadingDate);
    
    if (bikesForDate.length === 0) {
      toast.error("No bikes scheduled for delivery on this date");
      return;
    }

    // Group bikes by driver to get unique drivers
    const driverGroups = bikesForDate.reduce((acc, order) => {
      const orderAllocations = storageAllocations.filter(a => a.orderId === order.id);
      
      // Find the delivery driver assignment
      const deliveryDriverName = getDriverAssignment(order, 'delivery') || 'Unassigned Driver';

      if (!acc[deliveryDriverName]) {
        acc[deliveryDriverName] = [];
      }
      acc[deliveryDriverName].push(order);
      return acc;
    }, {} as Record<string, any[]>);

    const uniqueDrivers = Object.keys(driverGroups);
    setDriversForLoading(uniqueDrivers);
    setDriverPhoneNumbers({});
    setShowDriverPhoneDialog(true);
  };

  const handleSendWithDriverNumbers = async () => {
    if (!selectedLoadingDate) return;

    try {
      const bikesForDate = getBikesNeedingLoading(selectedLoadingDate);
      const loadedBikesForDate = getBikesLoadedOnDate(selectedLoadingDate);
      
      // Format unloaded bikes data for the WhatsApp function
      const bikesNeedingLoadingData = bikesForDate.map(order => {
        const orderAllocations = storageAllocations.filter(a => a.orderId === order.id);
        
        // Get both collection and delivery driver assignments
        const collectionDriverName = getDriverAssignment(order, 'pickup') || null;
        const deliveryDriverName = getDriverAssignment(order, 'delivery') || 'Unassigned Driver';

        return {
          id: order.id,
          receiver: {
            name: order.receiver.name
          },
          bikeBrand: order.bikeBrand || '',
          bikeModel: order.bikeModel || '',
          trackingNumber: order.trackingNumber || '',
          bikeQuantity: order.bikeQuantity || 1,
          storageAllocations: orderAllocations.map(alloc => ({
            bay: alloc.bay,
            position: alloc.position
          })),
          collectionDriverName: collectionDriverName,
          deliveryDriverName: deliveryDriverName,
          isInStorage: orderAllocations.length > 0
        };
      });

      // Format loaded bikes data for the WhatsApp function  
      const bikesAlreadyLoadedData = loadedBikesForDate.map(order => {
        const deliveryDriverName = getDriverAssignment(order, 'delivery') || 'Unassigned Driver';
        const loadedTime = order.loaded_onto_van_at ? format(new Date(order.loaded_onto_van_at), 'HH:mm') : 'Unknown time';

        return {
          id: order.id,
          receiver: {
            name: order.receiver.name
          },
          bikeBrand: order.bikeBrand || '',
          bikeModel: order.bikeModel || '',
          trackingNumber: order.trackingNumber || '',
          bikeQuantity: order.bikeQuantity || 1,
          driverName: deliveryDriverName,
          loadedTime: loadedTime
        };
      });

      // Call the WhatsApp edge function
      const response = await supabase.functions.invoke('send-loading-list-whatsapp', {
        body: {
          date: format(selectedLoadingDate, 'PPP'),
          bikesNeedingLoading: bikesNeedingLoadingData,
          bikesAlreadyLoaded: bikesAlreadyLoadedData
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      toast.success(`Loading list sent successfully! ${result.totalBikes} bikes for ${result.driversCount} driver(s)`);
      
    } catch (error) {
      console.error('Error sending loading list:', error);
      toast.error('Failed to send loading list');
    }
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
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="mb-8">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div className="flex items-center gap-3">
              <Truck className="h-8 w-8 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">Loading & Unloading</h1>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-col gap-2 md:flex-row md:gap-3">
              {/* Print Collection Labels */}
              <Dialog open={isLabelsDialogOpen} onOpenChange={setIsLabelsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto">
                    <Printer className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Print Collection Labels</span>
                    <span className="sm:hidden">Print Labels</span>
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
                  <Button variant="outline" className="w-full md:w-auto">
                    <Package className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">View Loading List</span>
                    <span className="sm:hidden">Loading List</span>
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
                       <div className="space-y-6 max-h-96 overflow-y-auto">
                         {/* Header with summary stats */}
                         <div className="flex items-center justify-between">
                           <div>
                             <div className="font-medium">
                               Loading List for {format(selectedLoadingDate, 'PPP')}
                             </div>
                             <div className="text-sm text-muted-foreground mt-1">
                               {bikesLoadedOnDate.length + getBikesNeedingLoading(selectedLoadingDate).length} bikes scheduled • {bikesLoadedOnDate.length} loaded • {getBikesNeedingLoading(selectedLoadingDate).length} pending
                             </div>
                           </div>
                           {getBikesNeedingLoading(selectedLoadingDate).length > 0 && (
                             <Button 
                               size="sm" 
                               variant="outline"
                               onClick={handleSendLoadingList}
                             >
                               📱 Send Loading List
                             </Button>
                           )}
                         </div>

                         {/* Bikes Already Loaded Section */}
                         {bikesLoadedOnDate.length > 0 && (
                           <div className="space-y-3">
                             <div className="flex items-center gap-2">
                               <div className="h-4 w-4 bg-green-500 rounded-full"></div>
                               <h3 className="font-medium text-green-700">Bikes Already Loaded ({bikesLoadedOnDate.length})</h3>
                             </div>
                             <div className="space-y-2 bg-green-50 p-4 rounded-lg border border-green-200">
                               {bikesLoadedOnDate.map((order) => {
                                 const quantity = order.bikeQuantity || 1;
                                 const deliveryDriverName = getDriverAssignment(order, 'delivery');
                                 const loadedTime = order.loaded_onto_van_at ? format(new Date(order.loaded_onto_van_at), 'HH:mm') : 'Unknown time';
                                 
                                 return (
                                   <Card key={order.id} className="p-3 bg-white border-green-300">
                                     <div className="space-y-2">
                                       <div className="flex items-center justify-between">
                                         <div className="font-medium text-green-800">
                                           {order.receiver?.name || 'Unknown Customer'}
                                         </div>
                                         <div className="flex items-center gap-2">
                                           {quantity > 1 && (
                                             <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                               {quantity} bikes
                                             </div>
                                           )}
                                           <div className="text-xs bg-green-600 text-white px-2 py-1 rounded font-medium">
                                             Loaded {loadedTime}
                                           </div>
                                         </div>
                                       </div>
                                       <div className="text-sm text-green-700">
                                         <div>{order.bikeBrand} {order.bikeModel}</div>
                                         <div>Tracking: {order.trackingNumber}</div>
                                         <div>To: {order.receiver?.address?.city}, {order.receiver?.address?.zipCode}</div>
                                         {deliveryDriverName && (
                                           <div className="text-green-600 font-medium">On {deliveryDriverName} Van</div>
                                         )}
                                       </div>
                                     </div>
                                   </Card>
                                 );
                               })}
                             </div>
                           </div>
                         )}

                          {/* Bikes Still Need Loading Section */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 bg-orange-500 rounded-full"></div>
                              <h3 className="font-medium text-orange-700">Bikes Still Need Loading ({getBikesNeedingLoading(selectedLoadingDate).length})</h3>
                            </div>
                            
                            {getBikesNeedingLoading(selectedLoadingDate).length > 0 ? (
                              <div className="space-y-4 bg-orange-50 p-4 rounded-lg border border-orange-200">
                                 {(() => {
                                   // Group bikes by current location
                                   const bikesNeedingLoading = getBikesNeedingLoading(selectedLoadingDate);
                                   const locationGroups: Record<string, Order[]> = {};
                                   
                                   bikesNeedingLoading.forEach(order => {
                                     const orderAllocations = storageAllocations.filter(a => a.orderId === order.id);
                                     
                                     // Check if this is a same-day collection/delivery within 500m of depot
                                     const scheduledPickup = order.scheduledPickupDate;
                                     const scheduledDelivery = order.scheduledDeliveryDate;
                                     let isNearDepot = false;
                                     
                                     if (scheduledPickup && scheduledDelivery) {
                                       const pickupDate = format(new Date(scheduledPickup), 'yyyy-MM-dd');
                                       const deliveryDate = format(new Date(scheduledDelivery), 'yyyy-MM-dd');
                                       
                                       if (pickupDate === deliveryDate) {
                                         const collectionLat = order.sender?.address?.lat;
                                         const collectionLon = order.sender?.address?.lon;
                                         
                                         if (collectionLat && collectionLon) {
                                           const distanceToDepot = calculateDistanceInMeters(
                                             DEPOT_LOCATION.lat,
                                             DEPOT_LOCATION.lon,
                                             collectionLat,
                                             collectionLon
                                           );
                                           
                                           isNearDepot = distanceToDepot <= DEPOT_PROXIMITY_THRESHOLD_METERS;
                                         }
                                       }
                                     }
                                     
                                     if (orderAllocations.length > 0) {
                                       // Group by bay (column) for bikes in storage
                                       orderAllocations.forEach(allocation => {
                                         const bayKey = `Bay ${allocation.bay}`;
                                         if (!locationGroups[bayKey]) {
                                           locationGroups[bayKey] = [];
                                         }
                                         // Only add once per order, not per allocation
                                         if (!locationGroups[bayKey].some(o => o.id === order.id)) {
                                           locationGroups[bayKey].push(order);
                                         }
                                       });
                                     } else if (isNearDepot) {
                                       // Bikes that need to be collected from near depot
                                       if (!locationGroups['To Be Collected']) {
                                         locationGroups['To Be Collected'] = [];
                                       }
                                       locationGroups['To Be Collected'].push(order);
                                     } else {
                                       // Check if in a driver's van
                                       const collectionEvent = order.trackingEvents?.shipday?.updates?.find(
                                         (update: any) => update.event === 'ORDER_COMPLETED' && 
                                         update.orderId?.toString() === order.trackingEvents?.shipday?.pickup_id?.toString()
                                       );
                                       const driverName = collectionEvent?.driverName;
                                       
                                       if (driverName) {
                                         // Create group for this driver if it doesn't exist
                                         const driverKey = `${driverName} Van`;
                                         if (!locationGroups[driverKey]) {
                                           locationGroups[driverKey] = [];
                                         }
                                         locationGroups[driverKey].push(order);
                                       } else {
                                         // Unknown location
                                         if (!locationGroups['Driver Vans']) {
                                           locationGroups['Driver Vans'] = [];
                                         }
                                         locationGroups['Driver Vans'].push(order);
                                       }
                                     }
                                   });
                                   
                                   // Sort groups: Bays first (A, B, C, D), then other locations
                                   const sortedGroups = Object.entries(locationGroups).sort(([a], [b]) => {
                                     const bayOrder = ['Bay A', 'Bay B', 'Bay C', 'Bay D'];
                                     const aIndex = bayOrder.indexOf(a);
                                     const bIndex = bayOrder.indexOf(b);
                                     
                                     if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                                     if (aIndex !== -1) return -1;
                                     if (bIndex !== -1) return 1;
                                     return a.localeCompare(b);
                                   });
                                   
                                   // Render groups
                                   return sortedGroups
                                     .filter(([_, orders]) => orders.length > 0)
                                     .map(([locationName, orders]) => (
                                       <div key={locationName} className="space-y-2">
                                         <h4 className="font-semibold text-orange-800 text-sm uppercase tracking-wide border-b border-orange-300 pb-1">
                                           📍 {locationName} ({orders.length})
                                         </h4>
                                         <div className="space-y-2">
                                           {orders
                                             .sort((a, b) => {
                                               // Sort by lowest position number within the bay
                                               const aAllocations = storageAllocations.filter(alloc => alloc.orderId === a.id);
                                               const bAllocations = storageAllocations.filter(alloc => alloc.orderId === b.id);
                                               const aMinPos = Math.min(...aAllocations.map(alloc => alloc.position));
                                               const bMinPos = Math.min(...bAllocations.map(alloc => alloc.position));
                                               return aMinPos - bMinPos;
                                             })
                                             .map((order) => {
                                             const quantity = order.bikeQuantity || 1;
                                             const orderAllocations = storageAllocations.filter(a => a.orderId === order.id);
                                             
                                             return (
                                               <Card key={order.id} className="p-3 bg-white border-orange-300">
                                                 <div className="space-y-2">
                                                   <div className="flex items-center justify-between">
                                                     <div className="font-medium text-orange-800">
                                                       {order.receiver?.name || 'Unknown Customer'}
                                                     </div>
                                                     <div className="flex items-center gap-2">
                                                       {quantity > 1 && (
                                                         <div className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                                                           {quantity} bikes
                                                         </div>
                                                       )}
                                                       {orderAllocations.length > 0 && (
                                                         <div className="flex flex-wrap gap-1">
                                                           {orderAllocations
                                                             .sort((a, b) => {
                                                               if (a.bay !== b.bay) return a.bay.localeCompare(b.bay);
                                                               return a.position - b.position;
                                                             })
                                                            .map((allocation) => (
                                                              <div key={allocation.id} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-mono">
                                                                {allocation.bay}{allocation.position}
                                                              </div>
                                                            ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="text-sm text-orange-700">
                                                    <div>{order.bikeBrand} {order.bikeModel}</div>
                                                    <div>Tracking: {order.trackingNumber}</div>
                                                    <div>To: {order.receiver?.address?.city}, {order.receiver?.address?.zipCode}</div>
                                                    {(() => {
                                                      // Show who needs to load onto van (delivery driver)
                                                      const deliveryDriverName = getDriverAssignment(order, 'delivery');
                                                      
                                                      if (deliveryDriverName) {
                                                        return <div className="text-purple-600 font-medium">Load onto {deliveryDriverName} Van</div>;
                                                      }
                                                      return null;
                                                    })()}
                                                  </div>
                                                  <div className="mt-3 pt-3 border-t">
                                                    <Button 
                                                      size="sm" 
                                                      className="w-full"
                                                      onClick={() => handleLoadOntoVan(order.id)}
                                                    >
                                                      Load onto Van
                                                    </Button>
                                                  </div>
                                                </div>
                                              </Card>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ));
                                })()}
                              </div>
                            ) : (
                             <div className="text-center py-8 text-muted-foreground bg-orange-50 rounded-lg border border-orange-200">
                               <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                               <p>No bikes need loading for this date</p>
                             </div>
                           )}
                         </div>

                         {/* Empty state when no bikes at all */}
                         {bikesLoadedOnDate.length === 0 && getBikesNeedingLoading(selectedLoadingDate).length === 0 && (
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
        <Card className="mb-6 sm:mb-8">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">Storage Unit Layout</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <StorageUnitLayout 
              storageAllocations={storageAllocations}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Bikes Pending Storage Allocation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl">Bikes Pending Storage Allocation</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
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
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl">Bikes in Storage</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {bikesInStorage.length} bike(s) currently in storage
              </p>
            </CardHeader>
            <CardContent>
              <BikesInStorage 
                bikesInStorage={bikesInStorage}
                onRemoveFromStorage={handleRemoveFromStorage}
                onRemoveAllBikesFromOrder={handleRemoveAllBikesFromOrder}
                onChangeLocation={handleChangeLocation}
              />
            </CardContent>
          </Card>
        </div>

        {/* Remove Bikes Dialog */}
        <RemoveBikesDialog 
          open={showRemoveBikesDialog}
          onOpenChange={setShowRemoveBikesDialog}
          bikesForDelivery={bikesForDelivery}
          storageAllocations={storageAllocations}
          onRemoveAllBikesFromOrder={handleRemoveAllBikesFromOrder}
        />

        {/* Driver Phone Numbers Dialog */}
        <Dialog open={showDriverPhoneDialog} onOpenChange={setShowDriverPhoneDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send Loading List</DialogTitle>
              <DialogDescription>
                Enter phone numbers for drivers (optional). The management team will always receive the list.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {driversForLoading.map((driver) => (
                <div key={driver} className="space-y-2">
                  <Label htmlFor={`phone-${driver}`}>{driver}</Label>
                  <Input
                    id={`phone-${driver}`}
                    type="tel"
                    placeholder="+44..."
                    value={driverPhoneNumbers[driver] || ''}
                    onChange={(e) => setDriverPhoneNumbers(prev => ({
                      ...prev,
                      [driver]: e.target.value
                    }))}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDriverPhoneDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendWithDriverNumbers}>
                Send Loading List
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default LoadingUnloadingPage;