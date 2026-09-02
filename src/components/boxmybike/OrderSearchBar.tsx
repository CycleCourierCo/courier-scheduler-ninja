import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface OrderSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const OrderSearchBar: React.FC<OrderSearchBarProps> = ({ value, onChange, placeholder }) => (
  <div className="relative mb-4 w-full">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Search tracking number, name, bike, postcode or bay…"}
      className="pl-9 pr-9"
      aria-label="Search orders"
    />
    {value && (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
        onClick={() => onChange("")}
        aria-label="Clear search"
      >
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>
);

export default OrderSearchBar;
