import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Truck, Loader2, Link } from "lucide-react";

interface ShipdayCarrier {
  id: number;
  personalId: string;
  name: string;
  codeName: string;
  phoneNumber: string;
  email: string;
  isOnShift: boolean;
  isActive: boolean;
}

interface ShipdayCarriersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinkCarrier?: (carrierId: number, carrierName: string) => void;
}

const ShipdayCarriersDialog: React.FC<ShipdayCarriersDialogProps> = ({ open, onOpenChange, onLinkCarrier }) => {
  const [carriers, setCarriers] = useState<ShipdayCarrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchCarriers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-shipday-carriers');
      if (error) throw error;
      setCarriers(data || []);
      setFetched(true);
    } catch (error: any) {
      console.error("Error fetching carriers:", error);
      toast.error("Failed to fetch Shipday carriers");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open && !fetched) {
      fetchCarriers();
    }
  }, [open]);

  const handleOpenChange = (val: boolean) => {
    if (!val) setFetched(false);
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Shipday Carriers
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : carriers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No carriers found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>On Shift</TableHead>
                {onLinkCarrier && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {carriers.map((carrier) => (
                <TableRow key={carrier.id}>
                  <TableCell className="font-mono">{carrier.id}</TableCell>
                  <TableCell className="font-medium">{carrier.name}</TableCell>
                  <TableCell>{carrier.phoneNumber || "—"}</TableCell>
                  <TableCell>{carrier.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={carrier.isActive ? "default" : "secondary"}>
                      {carrier.isActive ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={carrier.isOnShift ? "default" : "outline"}>
                      {carrier.isOnShift ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  {onLinkCarrier && (
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onLinkCarrier(carrier.id, carrier.name)}
                      >
                        <Link className="h-4 w-4 mr-1" />
                        Link to Driver
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShipdayCarriersDialog;
