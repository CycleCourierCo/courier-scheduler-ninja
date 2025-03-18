
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Control, UseFormSetValue } from "react-hook-form";
import { Loader2, Search } from "lucide-react";
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AddressFormProps {
  control: Control<any>;
  prefix: string;
  setValue: UseFormSetValue<any>;
}

interface AddressSuggestion {
  properties: {
    formatted: string;
    street: string;
    city: string;
    county: string;
    state: string;
    postcode: string;
    country: string;
  };
}

const AddressForm: React.FC<AddressFormProps> = ({ control, prefix, setValue }) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAddressSuggestions = async (text: string) => {
    if (!text || text.length < 3) {
      setSuggestions([]);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&apiKey=06b0c657cdcb466889f61736b5bb56c3`,
        { method: 'GET' }
      );
      
      const data = await response.json();
      // Make sure data.features exists and is an array before setting it
      if (data && data.features && Array.isArray(data.features)) {
        setSuggestions(data.features);
      } else {
        // If features doesn't exist or isn't an array, set an empty array
        setSuggestions([]);
        console.warn("Geoapify API response doesn't contain the expected features array:", data);
      }
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchValue) {
        fetchAddressSuggestions(searchValue);
      } else {
        // Clear suggestions when search value is empty
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="mb-4">
          <FormLabel className="text-sm font-medium">Search Address</FormLabel>
          <div className="relative">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Input
                    placeholder="Search for an address..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onClick={() => setOpen(true)}
                    className="pl-8"
                  />
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Search address..." 
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  {loading && (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                    </div>
                  )}
                  <CommandEmpty>No address found.</CommandEmpty>
                  <CommandGroup className="max-h-[300px] overflow-auto">
                    {suggestions.map((suggestion, index) => (
                      <CommandItem
                        key={index}
                        onSelect={() => {
                          // Update all the relevant form fields with the selected address
                          setValue(`${prefix}.street`, suggestion.properties.street || "");
                          setValue(`${prefix}.city`, suggestion.properties.city || suggestion.properties.county || "");
                          setValue(`${prefix}.state`, suggestion.properties.state || "");
                          setValue(`${prefix}.zipCode`, suggestion.properties.postcode || "");
                          setValue(`${prefix}.country`, suggestion.properties.country || "");
                          setOpen(false);
                          setSearchValue("");
                        }}
                        className="cursor-pointer"
                      >
                        {suggestion.properties.formatted}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <FormField
        control={control}
        name={`${prefix}.street`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Street Address *</FormLabel>
            <FormControl>
              <Input placeholder="123 Main St" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`${prefix}.city`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>City *</FormLabel>
              <FormControl>
                <Input placeholder="New York" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${prefix}.state`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>State/Province *</FormLabel>
              <FormControl>
                <Input placeholder="NY" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`${prefix}.zipCode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zip/Postal Code *</FormLabel>
              <FormControl>
                <Input placeholder="10001" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${prefix}.country`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country *</FormLabel>
              <FormControl>
                <Input placeholder="United States" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

export default AddressForm;
