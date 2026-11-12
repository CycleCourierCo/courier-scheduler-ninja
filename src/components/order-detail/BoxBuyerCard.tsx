import React from "react";
import { User, Mail, Phone, Package } from "lucide-react";
import type { ContactInfo } from "@/types/order";

interface BoxBuyerCardProps {
  buyer?: Partial<ContactInfo> | null;
}

/** Box My Bike: the end buyer the boxed bike is going to (receiver is our depot). */
const BoxBuyerCard: React.FC<BoxBuyerCardProps> = ({ buyer }) => {
  const has = !!(buyer && (buyer.name || buyer.email || buyer.phone));
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Package className="h-4 w-4" /> Buyer (final customer)
      </h3>
      {!has ? (
        <p className="text-sm text-muted-foreground">No buyer details recorded</p>
      ) : (
        <div className="space-y-1 text-sm">
          {buyer?.name && (
            <p className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{buyer.name}</p>
          )}
          {buyer?.phone && (
            <a href={`tel:${buyer.phone}`} className="flex items-center gap-2 text-primary hover:underline break-all">
              <Phone className="h-4 w-4 text-muted-foreground" />{buyer.phone}
            </a>
          )}
          {buyer?.email && (
            <a href={`mailto:${buyer.email}`} className="flex items-center gap-2 text-primary hover:underline break-all">
              <Mail className="h-4 w-4 text-muted-foreground" />{buyer.email}
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default BoxBuyerCard;
